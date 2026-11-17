// In-memory login throttle: enough for a single-salon app on one server process.
// Per-key limit (client address) plus a larger global limit, so rotating a spoofed
// X-Forwarded-For header does not bypass it.

type Entry = { fails: number[]; lockedUntil: number };

const WINDOW_MS = 15 * 60 * 1000;
const LIMITS = { key: 5, global: 25 };

const store: Map<string, Entry> = ((globalThis as { __loginThrottle?: Map<string, Entry> }).__loginThrottle ??= new Map());

function entry(k: string): Entry {
  let e = store.get(k);
  if (!e) store.set(k, (e = { fails: [], lockedUntil: 0 }));
  return e;
}

/** Seconds the caller must still wait, or 0 if a login attempt is allowed. */
export function lockedForSeconds(key: string, now = Date.now()): number {
  const until = Math.max(entry(key).lockedUntil, entry("global").lockedUntil);
  return until > now ? Math.ceil((until - now) / 1000) : 0;
}

export function recordFailure(key: string, now = Date.now()) {
  for (const [k, limit] of [[key, LIMITS.key], ["global", LIMITS.global]] as const) {
    const e = entry(k);
    e.fails = e.fails.filter((t) => now - t < WINDOW_MS);
    e.fails.push(now);
    if (e.fails.length >= limit) {
      e.lockedUntil = now + WINDOW_MS;
      e.fails = [];
    }
  }
}

export function recordSuccess(key: string) {
  store.delete(key);
}

export function resetThrottle() {
  store.clear();
}
