import { Location } from '@shared/models/Location';
import { newId } from '@shared/utils/id';

export type WaypointType = 'PLANNED' | 'TRACK' | 'MARKED';

export type WaypointRow = {
  waypoint_id: string;
  route_id?: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  manually_marked: boolean;
  waypoint_type: WaypointType;
  sequence_no: number | null;
  note: string | null;
};

/** Waypoint (class diagram): waypointId, latitude, longitude, timestamp, manuallyMarked; getLocation(). */
export class Waypoint {
  constructor(
    readonly waypointId: string,
    readonly latitude: number,
    readonly longitude: number,
    readonly timestamp: string,
    readonly manuallyMarked: boolean,
    readonly waypointType: WaypointType,
    readonly note: string | null = null,
    readonly sequenceNo: number | null = null,
  ) {}

  static create(init: {
    latitude: number;
    longitude: number;
    manuallyMarked: boolean;
    waypointType: WaypointType;
    note?: string | null;
    timestamp?: string;
  }): Waypoint {
    return new Waypoint(
      newId(),
      init.latitude,
      init.longitude,
      init.timestamp ?? new Date().toISOString(),
      init.manuallyMarked,
      init.waypointType,
      init.note?.trim() || null,
    );
  }

  static fromRow(r: WaypointRow): Waypoint {
    return new Waypoint(r.waypoint_id, r.latitude, r.longitude, r.timestamp, r.manually_marked, r.waypoint_type, r.note, r.sequence_no);
  }

  getLocation(): Location {
    return new Location({ latitude: this.latitude, longitude: this.longitude, manuallyMarked: this.manuallyMarked });
  }

  toRow(): WaypointRow {
    return {
      waypoint_id: this.waypointId,
      latitude: this.latitude,
      longitude: this.longitude,
      timestamp: this.timestamp,
      manually_marked: this.manuallyMarked,
      waypoint_type: this.waypointType,
      sequence_no: this.sequenceNo,
      note: this.note,
    };
  }
}
