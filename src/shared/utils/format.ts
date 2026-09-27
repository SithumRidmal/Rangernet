const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function formatTime(value: string | number | Date | null | undefined): string {
  const d = toDate(value);
  return d ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : '—';
}

export function formatDate(value: string | number | Date | null | undefined): string {
  const d = toDate(value);
  return d ? `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` : '—';
}

export function formatDateTime(value: string | number | Date | null | undefined): string {
  const d = toDate(value);
  return d ? `${formatDate(d)} · ${formatTime(d)}` : '—';
}

export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function relativeTime(value: string | number | Date | null | undefined): string {
  const d = toDate(value);
  if (!d) return '—';
  const diff = Date.now() - d.getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  const days = Math.round(h / 24);
  if (days < 7) return `${days} d ago`;
  return formatDate(d);
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${pad(m)}m` : `${m}m`;
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export function formatKm(km: number | string | null | undefined, digits = 1): string {
  const n = Number(km);
  return Number.isFinite(n) ? `${n.toFixed(digits)} km` : '—';
}

export function formatCoord(lat?: number | null, lng?: number | null): string {
  if (lat === null || lat === undefined || lng === null || lng === undefined) return 'No coordinates';
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

export function formatCode(prefix: string, no: number | string | null | undefined): string {
  if (no === null || no === undefined || no === '') return `${prefix}-····`;
  return `${prefix}-${String(no).padStart(4, '0')}`;
}

export function initials(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export function maskEmail(email: string | null | undefined): string {
  if (!email) return '';
  const [user, domain] = email.split('@');
  if (!domain) return email;
  return `${user.slice(0, 2)}•••@${domain}`;
}

export function firstName(name: string | null | undefined): string {
  return (name ?? '').trim().split(/\s+/)[0] || '';
}
