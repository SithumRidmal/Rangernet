const PREFIX = 'rangernet:cache:';

type Stored<T> = {
  value: T;
  updatedAt: string;
};

export function getLocalDb(): Promise<never> {
  return Promise.reject(new Error('SQLite is not used in the web preview.'));
}

export async function cacheSet<T>(key: string, value: T): Promise<void> {
  window.localStorage.setItem(`${PREFIX}${key}`, JSON.stringify({ value, updatedAt: new Date().toISOString() } satisfies Stored<T>));
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const raw = window.localStorage.getItem(`${PREFIX}${key}`);
    if (!raw) return null;
    return (JSON.parse(raw) as Stored<T>).value;
  } catch {
    return null;
  }
}

export async function cacheRemove(key: string): Promise<void> {
  window.localStorage.removeItem(`${PREFIX}${key}`);
}
