import * as ExpoLocation from 'expo-location';

export type GeoPoint = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
};

export class GpsUnavailableError extends Error {
  reason: 'permission' | 'disabled' | 'timeout' | 'error';
  constructor(reason: GpsUnavailableError['reason'], message: string) {
    super(message);
    this.name = 'GpsUnavailableError';
    this.reason = reason;
  }
}

const toPoint = (l: ExpoLocation.LocationObject): GeoPoint => ({
  latitude: l.coords.latitude,
  longitude: l.coords.longitude,
  accuracy: l.coords.accuracy ?? null,
  timestamp: l.timestamp,
});

export async function ensureLocationPermission(): Promise<boolean> {
  const current = await ExpoLocation.getForegroundPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const req = await ExpoLocation.requestForegroundPermissionsAsync();
  return req.granted;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => resolve(null), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/** Obtains the current GPS position or throws GpsUnavailableError. */
export async function getGPSLocation(timeoutMs = 15000): Promise<GeoPoint> {
  if (!(await ensureLocationPermission())) {
    throw new GpsUnavailableError('permission', 'Location permission was denied.');
  }
  if (!(await ExpoLocation.hasServicesEnabledAsync())) {
    throw new GpsUnavailableError('disabled', 'Location services (GPS) are turned off.');
  }
  try {
    const fix = await withTimeout(
      ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.High }),
      timeoutMs,
    );
    if (fix) return toPoint(fix);
    const last = await ExpoLocation.getLastKnownPositionAsync({ maxAge: 2 * 60 * 1000 });
    if (last) return toPoint(last);
    throw new GpsUnavailableError('timeout', 'Could not get a GPS fix. Move to open sky or mark the location manually.');
  } catch (e) {
    if (e instanceof GpsUnavailableError) throw e;
    throw new GpsUnavailableError('error', e instanceof Error ? e.message : 'GPS unavailable');
  }
}

export type GpsWatch = { remove: () => void };

/** Continuous GPS tracking (foreground). */
export async function watchGPS(
  onPoint: (p: GeoPoint) => void,
  onError: (message: string) => void,
  options: { distanceInterval?: number; timeInterval?: number } = {},
): Promise<GpsWatch> {
  if (!(await ensureLocationPermission())) {
    throw new GpsUnavailableError('permission', 'Location permission was denied.');
  }
  if (!(await ExpoLocation.hasServicesEnabledAsync())) {
    throw new GpsUnavailableError('disabled', 'Location services (GPS) are turned off.');
  }
  const sub = await ExpoLocation.watchPositionAsync(
    {
      accuracy: ExpoLocation.Accuracy.High,
      distanceInterval: options.distanceInterval ?? 10,
      timeInterval: options.timeInterval ?? 5000,
    },
    (l) => onPoint(toPoint(l)),
    (reason) => onError(reason),
  );
  return { remove: () => sub.remove() };
}

export async function isGpsEnabled(): Promise<boolean> {
  try {
    return await ExpoLocation.hasServicesEnabledAsync();
  } catch {
    return false;
  }
}

export function distanceKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.latitude * Math.PI) / 180) * Math.cos((b.latitude * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}
