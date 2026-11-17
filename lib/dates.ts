// Pure date and phone helpers (no imports, so they can be unit-tested directly).
// "Today" is the clinic's local calendar day, not UTC, so day boundaries do not shift at night.

const TZ = process.env.CLINIC_TZ || "Europe/Istanbul";

export function dayOf(date: Date, tz = TZ): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export const today = (): string => dayOf(new Date());

export function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(toIso + "T00:00:00Z") - Date.parse(fromIso + "T00:00:00Z")) / 86400000);
}

export function formatDateTR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

export function weekdayTR(iso: string): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("tr-TR", { weekday: "long", timeZone: "UTC" });
}

// Accepts 2026-10-31 or 31.10.2026 (or 31/10/2026). Returns ISO or null.
export function parseDateFlexible(raw: string): string | null {
  const s = raw.trim();
  let y: string, m: string, d: string;
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (match) [, y, m, d] = match;
  else if ((match = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(s))) [, d, m, y] = match;
  else return null;
  const iso = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  const parsed = new Date(iso + "T00:00:00Z");
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== iso ? null : iso;
}

// Turkish mobile numbers -> international digits for wa.me (e.g. 0532 123 45 67 -> 905321234567)
export function normalizePhone(raw: string): string | null {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0")) d = "90" + d.slice(1);
  else if (d.length === 10 && d.startsWith("5")) d = "90" + d;
  return /^\d{11,15}$/.test(d) ? d : null;
}

export function ageText(birthIso: string | null, now = today()): string {
  if (!birthIso) return "";
  const days = daysBetween(birthIso, now);
  if (days < 0) return "";
  if (days < 60) return `${days} günlük`;
  const months = Math.floor(days / 30.44);
  if (months < 24) return `${months} aylık`;
  return `${Math.floor(days / 365.25)} yaşında`;
}
