import { AppState, type AppStateStatus, type NativeEventSubscription } from 'react-native';
import { useSyncExternalStore } from 'react';
import {
  distanceKm,
  getGPSLocation,
  GpsUnavailableError,
  watchGPS,
  type GeoPoint,
  type GpsWatch,
} from '@shared/location/LocationService';
import { localStore } from '@shared/sync/LocalStorage';
import { synchronizationService } from '@shared/sync/SynchronizationService';
import { getErrorMessage } from '@shared/utils/errors';
import { Patrol } from '../models/Patrol';
import { PatrolRoute } from '../models/PatrolRoute';
import type { Waypoint } from '../models/Waypoint';
import type { PatrolPointPayload } from './CentralOperationsSystem';
import { patrolSessionStore, type PatrolSession } from './patrolSessionStore';

export type GpsState = 'idle' | 'acquiring' | 'tracking' | 'unavailable' | 'lost';

export type TrackerState = {
  session: PatrolSession | null;
  patrol: Patrol | null;
  points: Waypoint[];
  lastFix: GeoPoint | null;
  gps: GpsState;
  gpsMessage: string | null;
  distanceKm: number;
  error: string | null;
};

export type PatrolStartPayload = { ownerId: string; patrolId: string; startTime: string };
export type PatrolPointsPayload = { ownerId: string; patrolId: string; points: PatrolPointPayload[] };
export type PatrolCompletePayload = {
  ownerId: string;
  patrolId: string;
  endTime: string;
  completed: boolean;
  reason: string | null;
};

export type PatrolSummary = {
  patrolId: string;
  code: string;
  title: string;
  status: 'Completed' | 'Incomplete';
  startTime: string;
  endTime: string;
  distanceKm: number;
  coveragePercent: number | null;
  plannedCount: number;
  visitedCount: number;
  markedCount: number;
  reason: string | null;
};

const MAX_TRACK_ACCURACY_M = 75;
const FLUSH_EVERY_POINTS = 20;
const FLUSH_EVERY_MS = 60_000;
const RECONNECT_MS = 20_000;
const FRESH_FIX_MS = 30_000;

const toPayload = (w: Waypoint): PatrolPointPayload => ({
  waypoint_id: w.waypointId,
  latitude: w.latitude,
  longitude: w.longitude,
  timestamp: w.timestamp,
  waypoint_type: w.waypointType === 'MARKED' ? 'MARKED' : 'TRACK',
  manually_marked: w.manuallyMarked,
  note: w.note,
});

function routeDistance(points: Waypoint[]): number {
  let d = 0;
  for (let i = 1; i < points.length; i++) d += distanceKm(points[i - 1], points[i]);
  return d;
}

/**
 * Patrol App side of the UC-02 sequence diagram: keeps the patrol session,
 * runs continuous GPS tracking (foreground), stores every position locally and
 * hands batches to the outbox so they reach the Central System when online.
 */
class PatrolTracker {
  private state: TrackerState = {
    session: null,
    patrol: null,
    points: [],
    lastFix: null,
    gps: 'idle',
    gpsMessage: null,
    distanceKm: 0,
    error: null,
  };
  private listeners = new Set<() => void>();
  private watch: GpsWatch | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private appStateSub: NativeEventSubscription | null = null;
  private lastFlush = Date.now();
  private unqueued = 0;
  private ownerId: string | null = null;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getState = () => this.state;

  private set(patch: Partial<TrackerState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  /** Restores an active session after the app was closed (resume patrol). */
  async load(ownerId: string): Promise<void> {
    this.ownerId = ownerId;
    this.appStateSub ??= AppState.addEventListener('change', this.onAppState);
    try {
      await patrolSessionStore.purgeEnded();
      const session = await patrolSessionStore.active(ownerId);
      if (!session) {
        this.set({ session: null, patrol: null, points: [], distanceKm: 0, gps: 'idle', error: null });
        return;
      }
      const patrol = Patrol.fromRow(session.patrol);
      patrol.startPatrol(session.startTime);
      const points = await patrolSessionStore.points(session.patrolId);
      points.forEach((p) => patrol.route.addWaypoint(p));
      this.unqueued = (await patrolSessionStore.unqueuedPoints(session.patrolId)).length;
      this.set({ session, patrol, points: patrol.route.getRoute(), distanceKm: routeDistance(points), error: null });
      void this.startWatch();
    } catch (e) {
      this.set({ error: `Could not restore the patrol session: ${getErrorMessage(e)}` });
    }
  }

  /** Stops GPS and timers (sign-out / navigator unmount). The session itself stays stored. */
  stop() {
    this.clearWatch();
    this.appStateSub?.remove();
    this.appStateSub = null;
    this.ownerId = null;
    this.set({ gps: 'idle' });
  }

  get isActive() {
    return this.state.session?.state === 'active';
  }

  /** Select Start Patrol -> create patrol session -> record start time -> activate location tracking. */
  async start(patrol: Patrol, ownerId: string): Promise<void> {
    if (this.isActive && this.state.session?.patrolId !== patrol.patrolId) {
      throw new Error(`Finish ${this.state.patrol?.code ?? 'the active patrol'} before starting another one.`);
    }
    if (this.isActive) return;
    this.ownerId = ownerId;
    this.appStateSub ??= AppState.addEventListener('change', this.onAppState);
    const startTime = patrol.startTime ?? new Date().toISOString();
    patrol.startPatrol(startTime);
    await patrolSessionStore.create({ patrolId: patrol.patrolId, ownerId, patrol: patrol.row, startTime });
    await localStore.save<PatrolStartPayload>({
      entity: 'patrol',
      op: 'start',
      groupKey: patrol.patrolId,
      label: `${patrol.code} started`,
      payload: { ownerId, patrolId: patrol.patrolId, startTime },
    });
    const session = await patrolSessionStore.get(patrol.patrolId);
    this.unqueued = 0;
    this.lastFlush = Date.now();
    this.set({ session, patrol, points: [], distanceKm: 0, error: null, lastFix: null });
    void synchronizationService.retrySynchronization();
    await this.startWatch();
  }

  /** Activate location tracking; if GPS is unavailable the app keeps trying to reconnect. */
  async startWatch(): Promise<void> {
    if (!this.isActive || this.watch) return;
    this.clearReconnect();
    this.set({ gps: 'acquiring', gpsMessage: null });
    try {
      this.watch = await watchGPS(this.onPoint, this.onGpsError, { distanceInterval: 10, timeInterval: 5000 });
      if (!this.isActive) this.clearWatch();
    } catch (e) {
      const message = e instanceof GpsUnavailableError ? e.message : getErrorMessage(e, 'Location service unavailable.');
      this.set({ gps: 'unavailable', gpsMessage: message });
      this.scheduleReconnect();
    }
  }

  /** "Attempt reconnect" from the GPS unavailable state. */
  async reconnect(): Promise<void> {
    this.clearWatch();
    await this.startWatch();
  }

  private onPoint = (p: GeoPoint) => {
    const { patrol, session } = this.state;
    if (!patrol || !session || session.state !== 'active') return;
    if (p.accuracy !== null && p.accuracy > MAX_TRACK_ACCURACY_M) {
      this.set({ lastFix: p, gps: 'tracking', gpsMessage: `Weak GPS signal (±${Math.round(p.accuracy)} m)` });
      return;
    }
    const waypoint = patrol.recordGPSPosition(p);
    const points = patrol.route.getRoute();
    this.set({
      lastFix: p,
      gps: 'tracking',
      gpsMessage: null,
      points,
      distanceKm: routeDistance(points),
    });
    this.persist(session.patrolId, waypoint, p.accuracy);
  };

  private onGpsError = (message: string) => {
    this.clearWatch();
    this.set({ gps: 'lost', gpsMessage: message || 'GPS signal lost.' });
    this.scheduleReconnect();
  };

  private persist(patrolId: string, waypoint: Waypoint, accuracy: number | null) {
    patrolSessionStore
      .addPoint(patrolId, waypoint, accuracy)
      .then(() => {
        this.unqueued += 1;
        return this.flush(false);
      })
      .catch((e) => this.set({ error: `Recording error - data kept in memory: ${getErrorMessage(e)}` }));
  }

  /** Current position for a marked waypoint: recent fix, a fresh GPS reading, or throws (manual marking). */
  async currentPosition(): Promise<GeoPoint> {
    const fix = this.state.lastFix;
    if (fix && Date.now() - fix.timestamp < FRESH_FIX_MS) return fix;
    return getGPSLocation(10000);
  }

  /** Mark waypoint (step 6 / 11a) or record manual waypoint while GPS is unavailable (7a). */
  async markWaypoint(init: { latitude: number; longitude: number; manuallyMarked: boolean; note?: string | null }): Promise<Waypoint> {
    const { patrol, session } = this.state;
    if (!patrol || !session || session.state !== 'active') throw new Error('No active patrol.');
    const waypoint = patrol.markWaypoint(init);
    await patrolSessionStore.addPoint(session.patrolId, waypoint, null);
    this.unqueued += 1;
    const points = patrol.route.getRoute();
    this.set({ points, distanceKm: routeDistance(points) });
    await this.flush(true);
    return waypoint;
  }

  /** Moves locally stored points into the synchronization queue. */
  async flush(force: boolean): Promise<void> {
    const { session, patrol } = this.state;
    if (!session || !patrol || !this.ownerId) return;
    if (!force && this.unqueued < FLUSH_EVERY_POINTS && Date.now() - this.lastFlush < FLUSH_EVERY_MS) return;
    try {
      const pending = await patrolSessionStore.unqueuedPoints(session.patrolId);
      this.lastFlush = Date.now();
      if (pending.length === 0) {
        this.unqueued = 0;
        return;
      }
      const marked = pending.filter((p) => p.waypointType === 'MARKED').length;
      await localStore.save<PatrolPointsPayload>({
        entity: 'patrol',
        op: 'points',
        groupKey: session.patrolId,
        label: `${patrol.code} · ${pending.length} position${pending.length === 1 ? '' : 's'}${marked ? ` (${marked} marked)` : ''}`,
        payload: { ownerId: session.ownerId, patrolId: session.patrolId, points: pending.map(toPayload) },
      });
      await patrolSessionStore.markQueued(pending.map((p) => p.waypointId));
      this.unqueued = 0;
      if (this.state.error) this.set({ error: null });
      void synchronizationService.retrySynchronization();
    } catch (e) {
      this.set({ error: `Positions are saved on the device but could not be queued: ${getErrorMessage(e)}` });
    }
  }

  /** Complete Patrol (step 7) or confirmed stop early -> Incomplete (14a). */
  async finish(completed: boolean, reason: string | null): Promise<PatrolSummary> {
    const { session, patrol } = this.state;
    if (!session || !patrol) throw new Error('No active patrol.');
    await this.flush(true);
    if (this.unqueued > 0) throw new Error(this.state.error ?? 'Could not save the recorded positions. Please retry.');
    const endTime = new Date().toISOString();
    const status = completed ? 'Completed' : 'Incomplete';
    await localStore.save<PatrolCompletePayload>({
      entity: 'patrol',
      op: 'complete',
      groupKey: session.patrolId,
      label: `${patrol.code} ${completed ? 'completed' : 'stopped early'}`,
      payload: { ownerId: session.ownerId, patrolId: session.patrolId, endTime, completed, reason },
    });
    await patrolSessionStore.end(session.patrolId, endTime, status, reason);
    this.clearWatch();
    const summary = PatrolTracker.summarize(patrol, session.startTime, endTime, status, reason);
    this.set({ session: null, patrol: null, points: [], distanceKm: 0, gps: 'idle', gpsMessage: null, lastFix: null, error: null });
    void synchronizationService.retrySynchronization();
    return summary;
  }

  /** Calculate final route and coverage on the device (the server repeats this when it syncs). */
  static summarize(
    patrol: Patrol,
    startTime: string,
    endTime: string,
    status: 'Completed' | 'Incomplete',
    reason: string | null,
  ): PatrolSummary {
    const recorded = patrol.route.getRoute();
    const calc = PatrolRoute.calculate(patrol.route.plannedWaypoints(), recorded, patrol.route.plannedDistanceKm);
    return {
      patrolId: patrol.patrolId,
      code: patrol.code,
      title: patrol.title,
      status,
      startTime,
      endTime,
      distanceKm: calc.distanceKm,
      coveragePercent: calc.coveragePercent,
      plannedCount: calc.plannedCount,
      visitedCount: calc.visitedCount,
      markedCount: patrol.route.markedWaypoints().length,
      reason,
    };
  }

  private onAppState = (next: AppStateStatus) => {
    if (!this.isActive) return;
    if (next === 'active') void this.startWatch();
    else void this.flush(true);
  };

  private scheduleReconnect() {
    this.clearReconnect();
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.isActive && !this.watch) void this.startWatch();
    }, RECONNECT_MS);
  }

  private clearReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private clearWatch() {
    this.clearReconnect();
    this.watch?.remove();
    this.watch = null;
  }
}

export const patrolTracker = new PatrolTracker();

export function usePatrolTracker(): TrackerState {
  return useSyncExternalStore(patrolTracker.subscribe, patrolTracker.getState);
}
