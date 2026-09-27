import * as ImagePicker from 'expo-image-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { supabase } from '../lib/supabase';
import { newId } from '../utils/id';
import { ServiceError } from '../utils/errors';

export type LocalPhoto = {
  photoId: string;
  /** file:// URI inside the app's document directory (survives restarts until synced). */
  uri: string;
  capturedAt: string;
};

export class CameraUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CameraUnavailableError';
  }
}

export class InvalidPhotoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidPhotoError';
  }
}

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

function photoDir(): Directory {
  const dir = new Directory(Paths.document, 'photos');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

function persist(asset: ImagePicker.ImagePickerAsset): LocalPhoto {
  if (asset.type && asset.type !== 'image') throw new InvalidPhotoError('Only photos can be attached.');
  if (asset.mimeType && !asset.mimeType.startsWith('image/')) throw new InvalidPhotoError('The selected file is not an image.');
  if (asset.fileSize && asset.fileSize > MAX_PHOTO_BYTES) throw new InvalidPhotoError('The photo is larger than 10 MB.');
  const photoId = newId();
  const source = new File(asset.uri);
  if (!source.exists) throw new InvalidPhotoError('The photo file could not be read.');
  const target = new File(photoDir(), `${photoId}.jpg`);
  source.copy(target);
  return { photoId, uri: target.uri, capturedAt: new Date().toISOString() };
}

/** capturePhoto(): opens the camera and stores the captured photo on the device. */
export async function capturePhoto(): Promise<LocalPhoto | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) throw new CameraUnavailableError('Camera permission was denied. Enable it in system settings.');
  let result: ImagePicker.ImagePickerResult;
  try {
    result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.6, exif: false });
  } catch (e) {
    throw new CameraUnavailableError(e instanceof Error ? e.message : 'The camera could not be opened.');
  }
  if (result.canceled || !result.assets?.[0]) return null;
  return persist(result.assets[0]);
}

/** Picks an existing photo from the gallery (community reports allow optional photos). */
export async function pickPhoto(): Promise<LocalPhoto | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new CameraUnavailableError('Photo library permission was denied.');
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6, exif: false });
  if (result.canceled || !result.assets?.[0]) return null;
  return persist(result.assets[0]);
}

export function deleteLocalPhoto(uri: string) {
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // Already removed.
  }
}

export function localPhotoExists(uri: string): boolean {
  try {
    return new File(uri).exists;
  } catch {
    return false;
  }
}

/** Uploads a locally stored photo to a private Supabase Storage bucket (idempotent). */
export async function uploadPhoto(bucket: string, localUri: string, storagePath: string): Promise<string> {
  const file = new File(localUri);
  if (!file.exists) throw new ServiceError('The photo is no longer on this device.', 'P0002');
  const bytes = await file.arrayBuffer();
  const { error } = await supabase.storage.from(bucket).upload(storagePath, bytes, {
    contentType: 'image/jpeg',
    upsert: true,
  });
  if (error) throw new ServiceError(error.message);
  return storagePath;
}

export async function signedUrl(bucket: string, path: string, expiresIn = 3600): Promise<string | null> {
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  return data?.signedUrl ?? null;
}
