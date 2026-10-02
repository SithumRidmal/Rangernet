import { Patrol } from '../models';
import type { PatrolRow } from '../services/rows';
import type { RemoteCodec } from './useRemoteData';

export const patrolListCodec: RemoteCodec<Patrol[]> = {
  toCache: (list) => list.map((p) => p.toRow()),
  fromCache: (cached) => (cached as PatrolRow[]).map((r) => Patrol.fromRow(r)),
};

export const patrolCodec: RemoteCodec<Patrol> = {
  toCache: (p) => p.toRow(),
  fromCache: (cached) => Patrol.fromRow(cached as PatrolRow),
};
