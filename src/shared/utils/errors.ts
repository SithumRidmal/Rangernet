type ErrorLike = { message?: unknown; code?: unknown; status?: unknown; statusCode?: unknown; name?: unknown };

/** Error raised from a Supabase / PostgREST response that keeps the Postgres error code. */
export class ServiceError extends Error {
  code: string;
  constructor(message: string, code = '') {
    super(message);
    this.name = 'ServiceError';
    this.code = code;
  }
}

export function unwrap<T>(result: { data: T | null; error: ErrorLike | null }): T {
  if (result.error) {
    throw new ServiceError(String(result.error.message ?? 'Request failed'), String(result.error.code ?? ''));
  }
  return result.data as T;
}

export function getErrorMessage(e: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (!e) return fallback;
  if (typeof e === 'string') return e;
  const msg = (e as ErrorLike).message;
  if (typeof msg === 'string' && msg.trim()) {
    if (/network request failed|failed to fetch|fetch failed|network error/i.test(msg)) {
      return 'No connection to the server. Check your network and try again.';
    }
    return msg;
  }
  return fallback;
}

/**
 * Validation / permission / conflict errors from Postgres are final: retrying the
 * same payload will never succeed. Everything else (network, timeouts, 5xx) is retried.
 */
export function isRetryableError(e: unknown): boolean {
  if (!e) return true;
  const err = e as ErrorLike;
  const code = String(err.code ?? '');
  if (/^(22|23|42|P0)/.test(code)) return false;
  const status = Number(err.status ?? err.statusCode);
  if (Number.isFinite(status) && status >= 400 && status < 500 && status !== 408 && status !== 429) return false;
  return true;
}

export function isNetworkError(e: unknown): boolean {
  const msg = String((e as ErrorLike)?.message ?? '');
  return /network request failed|failed to fetch|fetch failed|network error|timeout|aborted/i.test(msg);
}
