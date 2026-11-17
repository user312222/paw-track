import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { TEMPLATE_SEED } from "./seed-templates.ts";

const DIR = process.env.CLINIC_DATA_DIR ? path.resolve(process.env.CLINIC_DATA_DIR) : path.join(process.cwd(), "data");
fs.mkdirSync(DIR, { recursive: true });

declare global {
  // eslint-disable-next-line no-var
  var __vetDb: DatabaseSync | undefined;
}

function open(): DatabaseSync {
  const db = new DatabaseSync(path.join(DIR, "clinic.db"));
  db.exec("PRAGMA busy_timeout = 10000"); // several build workers may open the file at once
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS owners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      consent INTEGER NOT NULL DEFAULT 0,
      consent_at TEXT,
      consent_note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS pets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      species TEXT NOT NULL DEFAULT 'köpek',
      breed TEXT NOT NULL DEFAULT '',
      sex TEXT NOT NULL DEFAULT '',
      birth_date TEXT,
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    -- Clinic records entered by the veterinarian: exam, surgery, vaccine, treatment, other.
    CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pet_id INTEGER NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
      done_on TEXT NOT NULL,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      procedures TEXT NOT NULL DEFAULT '',
      medications TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      vet_name TEXT NOT NULL DEFAULT ''
    );
    -- Control visits / vaccine dates the clinic wants to remind the owner about.
    CREATE TABLE IF NOT EXISTS reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pet_id INTEGER NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      due_on TEXT NOT NULL,
      sent_at TEXT
    );
    CREATE TABLE IF NOT EXISTS plan_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '',
      days INTEGER NOT NULL DEFAULT 7
    );
    CREATE TABLE IF NOT EXISTS template_steps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER NOT NULL REFERENCES plan_templates(id) ON DELETE CASCADE,
      day_no INTEGER NOT NULL,
      title TEXT NOT NULL,
      instructions TEXT NOT NULL DEFAULT '',
      kind TEXT NOT NULL DEFAULT 'task'
    );
    CREATE TABLE IF NOT EXISTS care_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pet_id INTEGER NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      token TEXT NOT NULL UNIQUE,
      vet_notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS care_steps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id INTEGER NOT NULL REFERENCES care_plans(id) ON DELETE CASCADE,
      day_date TEXT NOT NULL,
      title TEXT NOT NULL,
      instructions TEXT NOT NULL DEFAULT '',
      kind TEXT NOT NULL DEFAULT 'task',
      sort INTEGER NOT NULL DEFAULT 0,
      done_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_steps_plan_day ON care_steps(plan_id, day_date);
    -- One daily note per plan and day, written by the owner through the private link.
    CREATE TABLE IF NOT EXISTS checkins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id INTEGER NOT NULL REFERENCES care_plans(id) ON DELETE CASCADE,
      day_date TEXT NOT NULL,
      appetite INTEGER NOT NULL DEFAULT 2,
      water INTEGER NOT NULL DEFAULT 2,
      energy INTEGER NOT NULL DEFAULT 2,
      vomiting INTEGER NOT NULL DEFAULT 0,
      worried INTEGER NOT NULL DEFAULT 0,
      temp REAL,
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      reviewed_at TEXT,
      UNIQUE(plan_id, day_date)
    );
  `);
  seedTemplates(db);
  db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('clinic_name', 'Kliniğimiz')").run();
  return db;
}

// Starting points only. A veterinarian must review and edit these before using them with real patients.
function seedTemplates(db: DatabaseSync) {
  const n = db.prepare("SELECT COUNT(*) AS n FROM plan_templates").get() as { n: number };
  if (n.n > 0) return;
  const insT = db.prepare("INSERT INTO plan_templates (name, description, days) VALUES (?, ?, ?)");
  const insS = db.prepare("INSERT INTO template_steps (template_id, day_no, title, instructions, kind) VALUES (?, ?, ?, ?, ?)");
  for (const t of TEMPLATE_SEED) {
    const id = Number(insT.run(t.name, t.description, t.days).lastInsertRowid);
    for (const s of t.steps) insS.run(id, s.day_no, s.title, s.instructions, s.kind);
  }
}

function getDb(): DatabaseSync {
  return globalThis.__vetDb ?? (globalThis.__vetDb = open());
}

// Opened lazily on first query, so importing this module (e.g. during `next build`) never touches the file.
export const db: DatabaseSync = new Proxy({} as DatabaseSync, {
  get(_t, prop) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const v = real[prop];
    return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(real) : v;
  },
});

/** node:sqlite rows have a null prototype; Client Components only accept plain objects. */
export function plain<T>(rows: unknown[]): T[] {
  return rows.map((r) => ({ ...(r as object) })) as T[];
}

export type Owner = { id: number; name: string; phone: string; consent: number; consent_at: string | null; consent_note: string; created_at: string };
export type Pet = { id: number; owner_id: number; name: string; species: string; breed: string; sex: string; birth_date: string | null; notes: string; created_at: string };
export type Entry = { id: number; pet_id: number; done_on: string; kind: string; title: string; procedures: string; medications: string; notes: string; vet_name: string };
export type Plan = { id: number; pet_id: number; name: string; start_date: string; end_date: string; status: string; token: string; vet_notes: string; created_at: string };
export type Step = { id: number; plan_id: number; day_date: string; title: string; instructions: string; kind: string; sort: number; done_at: string | null };
export type CheckinRow = {
  id: number; plan_id: number; day_date: string; appetite: number; water: number; energy: number; vomiting: number; worried: number;
  temp: number | null; note: string; created_at: string; updated_at: string; reviewed_at: string | null;
};

export function getSetting(key: string, fallback = ""): string {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? fallback;
}
export function setSetting(key: string, value: string) {
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
}
