import { getGPSLocation as readGps } from '../location/LocationService';

/**
 * Location (class diagram) - shared by Incident (UC-01) and CommunityReport (UC-04).
 * Attributes: latitude, longitude, manuallyMarked.
 */
export class Location {
  latitude: number | null;
  longitude: number | null;
  manuallyMarked: boolean;
  /** Free-text location for community reports when no coordinates are available. */
  locationDescription: string | null;
  accuracy: number | null;

  constructor(init: {
    latitude?: number | null;
    longitude?: number | null;
    manuallyMarked?: boolean;
    locationDescription?: string | null;
    accuracy?: number | null;
  } = {}) {
    this.latitude = init.latitude ?? null;
    this.longitude = init.longitude ?? null;
    this.manuallyMarked = init.manuallyMarked ?? false;
    this.locationDescription = init.locationDescription ?? null;
    this.accuracy = init.accuracy ?? null;
  }

  /** getGPSLocation(): obtains the device position automatically. */
  static async getGPSLocation(): Promise<Location> {
    const p = await readGps();
    return new Location({ latitude: p.latitude, longitude: p.longitude, accuracy: p.accuracy, manuallyMarked: false });
  }

  /** markLocation(): location selected manually on the map when GPS is unavailable. */
  static markLocation(latitude: number, longitude: number, locationDescription?: string | null): Location {
    return new Location({ latitude, longitude, manuallyMarked: true, locationDescription: locationDescription ?? null });
  }

  static describe(locationDescription: string): Location {
    return new Location({ manuallyMarked: true, locationDescription });
  }

  hasCoordinates(): boolean {
    return (
      this.latitude !== null &&
      this.longitude !== null &&
      Math.abs(this.latitude) <= 90 &&
      Math.abs(this.longitude) <= 180 &&
      !(this.latitude === 0 && this.longitude === 0)
    );
  }

  toJSON() {
    return {
      latitude: this.latitude,
      longitude: this.longitude,
      manuallyMarked: this.manuallyMarked,
      locationDescription: this.locationDescription,
      accuracy: this.accuracy,
    };
  }

  static fromJSON(j: ReturnType<Location['toJSON']>): Location {
    return new Location(j);
  }
}
