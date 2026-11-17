import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { isLoggedIn } from "@/lib/auth";
import { db } from "@/lib/db";

// Consistent snapshot of the SQLite file (VACUUM INTO is safe while the app is running in WAL mode).
export async function GET() {
  if (!(await isLoggedIn())) return new Response("Unauthorized", { status: 401 });
  const tmp = path.join(os.tmpdir(), `salon-backup-${crypto.randomBytes(6).toString("hex")}.db`);
  try {
    db.exec(`VACUUM INTO '${tmp.replace(/'/g, "''")}'`);
    const data = fs.readFileSync(tmp);
    return new Response(data, {
      headers: {
        "content-type": "application/octet-stream",
        "content-disposition": `attachment; filename="salon-yedek-${new Date().toISOString().slice(0, 10)}.db"`,
        "cache-control": "no-store",
      },
    });
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}
