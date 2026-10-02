import type { PatrolRow } from '../models/Patrol';
import { Waypoint, type WaypointType } from '../models/Waypoint';
import type { PatrolCompletion } from '@navigation/ranger/CentralOperationsSystem';

const SESSIONS_KEY = 'rangernet:web:rangerPatrolSessions';
const POINTS_KEY = 'rangernet:web:rangerPatrolPoints';

export type PatrolSession = {
  patrolId: string;
  ownerId: string;
  patrol: PatrolRow;
  startTime: string;
  endTime: string | null;
  state: 'active' | 'ended';
  finalStatus: 'Completed' | 'Incomplete' | null;
  reason: string | null;
  result: PatrolCompletion | null;
};

type StoredPoint = {
  waypointId: string;
  patrolId: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  waypointType: WaypointType;
  manuallyMarked: boolean;
  note: string | null;
  accuracy: number | null;
  queued: boolean;
};

const toWaypoint = (p: StoredPoint) =>
  new Waypoint(p.waypointId, p.latitude, p.longitude, p.timestamp, p.manuallyMarked, p.waypointType, p.note);

export const patrolSessionStore = {
  async create(s: { patrolId: string; ownerId: string; patrol: PatrolRow; startTime: string }): Promise<void> {
    const rows = sessions().filter((r) => r.patrolId !== s.patrolId);
    write(SESSIONS_KEY, [
      ...rows,
      {
        patrolId: s.patrolId,
        ownerId: s.ownerId,
        patrol: s.patrol,
        startTime: s.startTime,
        endTime: null,
        state: 'active',
        finalStatus: null,
        reason: null,
        result: null,
      } satisfies PatrolSession,
    ]);
  },

  async active(ownerId: string): Promise<PatrolSession | null> {
    return (
      sessions()
        .filter((s) => s.ownerId === ownerId && s.state === 'active')
        .sort((a, b) => b.startTime.localeCompare(a.startTime))[0] ?? null
    );
  },

  async get(patrolId: string): Promise<PatrolSession | null> {
    return sessions().find((s) => s.patrolId === patrolId) ?? null;
  },

  async end(patrolId: string, endTime: string, finalStatus: 'Completed' | 'Incomplete', reason: string | null): Promise<void> {
    write(
      SESSIONS_KEY,
      sessions().map((s) => (s.patrolId === patrolId ? { ...s, state: 'ended' as const, endTime, finalStatus, reason } : s)),
    );
  },

  async setResult(patrolId: string, result: PatrolCompletion): Promise<void> {
    write(
      SESSIONS_KEY,
      sessions().map((s) => (s.patrolId === patrolId ? { ...s, result } : s)),
    );
  },

  async addPoint(patrolId: string, w: Waypoint, accuracy: number | null): Promise<void> {
    const rows = points();
    if (rows.some((p) => p.waypointId === w.waypointId)) return;
    write(POINTS_KEY, [
      ...rows,
      {
        waypointId: w.waypointId,
        patrolId,
        latitude: w.latitude,
        longitude: w.longitude,
        timestamp: w.timestamp,
        waypointType: w.waypointType,
        manuallyMarked: w.manuallyMarked,
        note: w.note,
        accuracy,
        queued: false,
      } satisfies StoredPoint,
    ]);
  },

  async points(patrolId: string): Promise<Waypoint[]> {
    return points()
      .filter((p) => p.patrolId === patrolId)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
      .map(toWaypoint);
  },

  async unqueuedPoints(patrolId: string): Promise<Waypoint[]> {
    return points()
      .filter((p) => p.patrolId === patrolId && !p.queued)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
      .map(toWaypoint);
  },

  async markQueued(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const set = new Set(ids);
    write(
      POINTS_KEY,
      points().map((p) => (set.has(p.waypointId) ? { ...p, queued: true } : p)),
    );
  },

  async purgeEnded(olderThanDays = 7): Promise<void> {
    const cutoff = new Date(Date.now() - olderThanDays * 86400000).toISOString();
    const purged = sessions().filter((s) => s.state === 'ended' && s.endTime && s.endTime < cutoff).map((s) => s.patrolId);
    if (purged.length === 0) return;
    const purgedSet = new Set(purged);
    write(
      SESSIONS_KEY,
      sessions().filter((s) => !purgedSet.has(s.patrolId)),
    );
    write(
      POINTS_KEY,
      points().filter((p) => !purgedSet.has(p.patrolId)),
    );
  },
};

function sessions() {
  return read<PatrolSession[]>(SESSIONS_KEY, []);
}

function points() {
  return read<StoredPoint[]>(POINTS_KEY, []);
}

function read<T>(key: string, fallback: T): T {
  const raw = window.localStorage.getItem(key);
  return raw ? (JSON.parse(raw) as T) : fallback;
}

function write<T>(key: string, value: T) {
  window.localStorage.setItem(key, JSON.stringify(value));
}
