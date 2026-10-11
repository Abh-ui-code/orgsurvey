export function formatDuration(seconds: number | null): string {
  if (seconds == null) return "—";
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (minutes === 0) return `${secs}s`;
  return `${minutes}m ${secs}s`;
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatRelativeShort(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const DAY_MS = 86_400_000;

/** Whole days from today (local) to a YYYY-MM-DD date: negative once it has passed. */
export function daysUntil(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  const due = new Date(y, m - 1, d).getTime();
  const today = new Date();
  return Math.round((due - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / DAY_MS);
}

/** "today", "1 day", "6 days" -- how long ago a timestamp was, in whole days. */
export function daysSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS));
}

export function pluralDays(n: number): string {
  return n === 1 ? "1 day" : `${n} days`;
}

/** "since today", "for 1 day", "for 6 days" -- how long something has been in its current state. */
export function sinceText(days: number): string {
  return days === 0 ? "since today" : `for ${pluralDays(days)}`;
}
