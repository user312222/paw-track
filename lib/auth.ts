import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE = "vet_session";

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set (see .env.local)");
  return s;
}

function sign(value: string): string {
  return crypto.createHmac("sha256", secret()).update(value).digest("hex");
}

export function checkPassword(input: string): boolean {
  const expected = process.env.CLINIC_PASSWORD;
  if (!expected) throw new Error("CLINIC_PASSWORD is not set (see .env.local)");
  const a = crypto.createHash("sha256").update(input).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

export async function startSession() {
  const exp = String(Date.now() + 1000 * 60 * 60 * 24 * 14);
  const jar = await cookies();
  jar.set(COOKIE, `${exp}.${sign(exp)}`, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 14 });
}

export async function endSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function isLoggedIn(): Promise<boolean> {
  const jar = await cookies();
  const v = jar.get(COOKIE)?.value;
  if (!v) return false;
  const [exp, sig] = v.split(".");
  if (!exp || !sig) return false;
  const good = sign(exp);
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return false;
  return Number(exp) > Date.now();
}

// Call at the top of every page and every Server Action that touches salon data.
export async function requireLogin() {
  if (!(await isLoggedIn())) redirect("/login");
}
