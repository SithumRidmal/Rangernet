import type { LatLng } from 'react-native-maps';
import type { WaypointRow, WaypointType } from '../services/rows';

/** Class diagram: Waypoint (composed by PatrolRoute). */
export class Waypoint {
  constructor(
    readonly waypointId: string,
    readonly latitude: number,
    readonly longitude: number,
    readonly timestamp: string,
    readonly manuallyMarked: boolean,
    readonly waypointType: WaypointType,
    readonly sequenceNo: number | null = null,
    readonly note: string | null = null,
  ) {}

  static fromRow(row: WaypointRow): Waypoint {
    return new Waypoint(
      row.waypoint_id,
      Number(row.latitude),
      Number(row.longitude),
      row.timestamp,
      !!row.manually_marked,
      row.waypoint_type,
      row.sequence_no,
      row.note,
    );
  }

  /** A waypoint the supervisor draws on the map while planning a route. */
  static planned(sequenceNo: number, latitude: number, longitude: number, note: string | null = null): Waypoint {
    return new Waypoint(`planned-${sequenceNo}`, latitude, longitude, new Date().toISOString(), true, 'PLANNED', sequenceNo, note);
  }

  getLocation(): LatLng {
    return { latitude: this.latitude, longitude: this.longitude };
  }

  isPlanned(): boolean {
    return this.waypointType === 'PLANNED';
  }

  isMarked(): boolean {
    return this.waypointType === 'MARKED';
  }

  isTrackPoint(): boolean {
    return this.waypointType === 'TRACK' || this.waypointType === 'MARKED';
  }
}
