import * as Crypto from 'expo-crypto';

/** Records are created with a device-generated UUID so offline sync is idempotent. */
export function newId(): string {
  return Crypto.randomUUID();
}
