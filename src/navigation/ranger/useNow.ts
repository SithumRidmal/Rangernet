import { useEffect, useState } from 'react';

/** Current time in ms, refreshed every `intervalMs` so durations and "today" stay accurate while mounted. */
export function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
