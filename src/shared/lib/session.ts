import { supabase } from './supabase';
import { ServiceError } from '../utils/errors';

export async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

/**
 * Offline records are delivered with the identity of the user who created them.
 * If someone else is signed in, the record stays queued (retryable) until they return.
 */
export async function assertRecordOwner(ownerId: string): Promise<string> {
  const uid = await currentUserId();
  if (!uid) throw new ServiceError('Waiting for sign-in before synchronizing.');
  if (uid !== ownerId) throw new ServiceError('Waiting for the user who created this record to sign in.');
  return uid;
}
