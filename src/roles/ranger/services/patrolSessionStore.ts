import type { SQLiteDatabase } from 'expo-sqlite';
import { getLocalDb } from '@shared/sync/localDb';
import type { PatrolRow } from '../models/Patrol';
import { Waypoint, type WaypointType } from '../models/Waypoint';
import type { PatrolCompletion } from './CentralOperationsSystem';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS ranger_patrol_sessions (
  patrol_id TEXT PRIMARY KEY NOT NULL,
  owner_id TEXT NOT NULL,
  patrol_json TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT,
  state TEXT NOT NULL,
  final_status TEXT,
  reason TEXT,
  result_json TEXT
);
CREATE TABLE IF NOT EXISTS ranger_patrol_points (
  waypoint_id TEXT PRIMARY KEY NOT NULL,
  patrol_id TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  timestamp TEXT NOT NULL,
  waypoint_type TEXT NOT NULL,
  manually_marked INTEGER NOT NULL,
  note TEXT,
  accuracy REAL,
  queued INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ranger_patrol_points_idx ON ranger_patrol_points (patrol_id, timestamp);
`;

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

type SessionRow = {
  patrol_id: string;
  owner_id: string;
  patrol_json: string;
  start_time: string;
  end_time: string | null;
  state: 'active' | 'ended';
  final_status: 'Completed' | 'Incomplete' | null;
  reason: string | null;
  result_json: string | null;
};

type PointRow = {
  waypoint_id: string;
  patrol_id: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  waypoint_type: WaypointType;
  manually_marked: number;
  note: string | null;
};

let ready: Promise<SQLiteDatabase> | null = null;
function db(): Promise<SQLiteDatabase> {
  if (!ready) {
    ready = getLocalDb()
      .then(async (d) => {
        await d.execAsync(SCHEMA);
        return d;
      })
      .catch((e) => {
        ready = null;
        throw e;
      });
  }
  return ready;
}

const toSession = (r: SessionRow): PatrolSession => ({
  patrolId: r.patrol_id,
  ownerId: r.owner_id,
  patrol: JSON.parse(r.patrol_json) as PatrolRow,
  startTime: r.start_time,
  endTime: r.end_time,
  state: r.state,
  finalStatus: r.final_status,
  reason: r.reason,
  result: r.result_json ? (JSON.parse(r.result_json) as PatrolCompletion) : null,
});

const toWaypoint = (r: PointRow) =>
  new Waypoint(r.waypoint_id, r.latitude, r.longitude, r.timestamp, !!r.manually_marked, r.waypoint_type, r.note);

/** Local Storage for the patrol session (UC-02 sequence: "Store GPS position and route coverage"). */
export const patrolSessionStore = {
  async create(s: { patrolId: string; ownerId: string; patrol: PatrolRow; startTime: string }): Promise<void> {
    const d = await db();
    await d.runAsync(
      `INSERT OR REPLACE INTO ranger_patrol_sessions (patrol_id, owner_id, patrol_json, start_time, state)
       VALUES (?, ?, ?, ?, 'active')`,
      s.patrolId,
      s.ownerId,
      JSON.stringify(s.patrol),
      s.startTime,
    );
  },

  async active(ownerId: string): Promise<PatrolSession | null> {
    const d = await db();
    const row = await d.getFirstAsync<SessionRow>(
      "SELECT * FROM ranger_patrol_sessions WHERE owner_id = ? AND state = 'active' ORDER BY start_time DESC LIMIT 1",
      ownerId,
    );
    return row ? toSession(row) : null;
  },

  async get(patrolId: string): Promise<PatrolSession | null> {
    const d = await db();
    const row = await d.getFirstAsync<SessionRow>('SELECT * FROM ranger_patrol_sessions WHERE patrol_id = ?', patrolId);
    return row ? toSession(row) : null;
  },

  async end(patrolId: string, endTime: string, finalStatus: 'Completed' | 'Incomplete', reason: string | null): Promise<void> {
    const d = await db();
    await d.runAsync(
      "UPDATE ranger_patrol_sessions SET state = 'ended', end_time = ?, final_status = ?, reason = ? WHERE patrol_id = ?",
      endTime,
      finalStatus,
      reason,
      patrolId,
    );
  },

  async setResult(patrolId: string, result: PatrolCompletion): Promise<void> {
    const d = await db();
    await d.runAsync('UPDATE ranger_patrol_sessions SET result_json = ? WHERE patrol_id = ?', JSON.stringify(result), patrolId);
  },

  async addPoint(patrolId: string, w: Waypoint, accuracy: number | null): Promise<void> {
    const d = await db();
    await d.runAsync(
      `INSERT OR IGNORE INTO ranger_patrol_points
       (waypoint_id, patrol_id, latitude, longitude, timestamp, waypoint_type, manually_marked, note, accuracy, queued)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      w.waypointId,
      patrolId,
      w.latitude,
      w.longitude,
      w.timestamp,
      w.waypointType,
      w.manuallyMarked ? 1 : 0,
      w.note,
      accuracy,
    );
  },

  async points(patrolId: string): Promise<Waypoint[]> {
    const d = await db();
    const rows = await d.getAllAsync<PointRow>('SELECT * FROM ranger_patrol_points WHERE patrol_id = ? ORDER BY timestamp ASC', patrolId);
    return rows.map(toWaypoint);
  },

  async unqueuedPoints(patrolId: string): Promise<Waypoint[]> {
    const d = await db();
    const rows = await d.getAllAsync<PointRow>(
      'SELECT * FROM ranger_patrol_points WHERE patrol_id = ? AND queued = 0 ORDER BY timestamp ASC',
      patrolId,
    );
    return rows.map(toWaypoint);
  },

  async markQueued(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const d = await db();
    await d.withTransactionAsync(async () => {
      for (const id of ids) await d.runAsync('UPDATE ranger_patrol_points SET queued = 1 WHERE waypoint_id = ?', id);
    });
  },

  /** Outbox payloads are self-contained, so old finished sessions can be removed safely. */
  async purgeEnded(olderThanDays = 7): Promise<void> {
    const d = await db();
    const cutoff = new Date(Date.now() - olderThanDays * 86400000).toISOString();
    const rows = await d.getAllAsync<{ patrol_id: string }>(
      "SELECT patrol_id FROM ranger_patrol_sessions WHERE state = 'ended' AND end_time < ?",
      cutoff,
    );
    for (const r of rows) {
      await d.runAsync('DELETE FROM ranger_patrol_points WHERE patrol_id = ?', r.patrol_id);
      await d.runAsync('DELETE FROM ranger_patrol_sessions WHERE patrol_id = ?', r.patrol_id);
    }
  },
};
