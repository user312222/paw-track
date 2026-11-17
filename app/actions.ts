"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db, setSetting } from "@/lib/db";
import { checkPassword, endSession, requireLogin, startSession } from "@/lib/auth";
import { addDays, normalizePhone, parseDateFlexible, today } from "@/lib/dates";
import { expandMedication, isStepKind, parseTemplateLines } from "@/lib/care";
import { createPlan, createPlanFromTemplate, extendPlanTo, insertSteps } from "@/lib/plans";
import { lockedForSeconds, recordFailure, recordSuccess } from "@/lib/ratelimit";

const str = (v: FormDataEntryValue | null, max = 200) => String(v ?? "").trim().slice(0, max);
const int = (v: FormDataEntryValue | null, min: number, max: number, fallback: number) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
const date = (v: FormDataEntryValue | null, fallback = today()) => parseDateFlexible(str(v, 12)) ?? fallback;
const SPECIES = ["köpek", "kedi", "kuş", "tavşan", "diğer"];
const CONSENT_SOURCES = ["sözlü", "yazılı / WhatsApp", "form / imza"];
const consentSource = (v: FormDataEntryValue | null) => (CONSENT_SOURCES.includes(str(v, 40)) ? str(v, 40) : "sözlü");
const ENTRY_KINDS = ["muayene", "ameliyat", "aşı", "tedavi", "kontrol", "diğer"];

// ---------------- session ----------------

export async function login(_prev: string | null, formData: FormData): Promise<string | null> {
  const h = await headers();
  const key = (h.get("x-forwarded-for")?.split(",")[0] ?? "local").trim();
  const wait = lockedForSeconds(key);
  if (wait > 0) return `Çok fazla yanlış deneme. ${Math.ceil(wait / 60)} dakika sonra tekrar deneyin.`;
  if (!checkPassword(str(formData.get("password"), 200))) {
    recordFailure(key);
    return "Şifre yanlış.";
  }
  recordSuccess(key);
  await startSession();
  redirect("/");
}

export async function logout() {
  await endSession();
  redirect("/login");
}

// ---------------- owners and pets ----------------

export async function addPatient(_prev: string | null, formData: FormData): Promise<string | null> {
  await requireLogin();
  const petName = str(formData.get("pet_name"), 60);
  if (!petName) return "Hayvanın adı gerekli.";
  const species = SPECIES.includes(str(formData.get("species"), 20)) ? str(formData.get("species"), 20) : "köpek";
  const birth = str(formData.get("birth_date"), 12) ? parseDateFlexible(str(formData.get("birth_date"), 12)) : null;
  if (str(formData.get("birth_date"), 12) && !birth) return "Doğum tarihi geçersiz (örn. 12.03.2022).";

  let ownerId = Number(formData.get("owner_id")) || 0;
  if (ownerId) {
    if (!db.prepare("SELECT 1 FROM owners WHERE id = ?").get(ownerId)) return "Sahip bulunamadı.";
  } else {
    const name = str(formData.get("owner_name"), 80);
    const phone = normalizePhone(str(formData.get("phone"), 30));
    if (!name) return "Sahibin adı gerekli.";
    if (!phone) return "Telefon numarası geçerli değil (örn. 0532 123 45 67).";
    const consent = formData.get("consent") === "on" ? 1 : 0;
    ownerId = Number(
      db
        .prepare("INSERT INTO owners (name, phone, consent, consent_at, consent_note) VALUES (?, ?, ?, ?, ?)")
        .run(name, phone, consent, consent ? new Date().toISOString() : null, consent ? consentSource(formData.get("consent_source")) : "").lastInsertRowid,
    );
  }
  const r = db
    .prepare("INSERT INTO pets (owner_id, name, species, breed, sex, birth_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(ownerId, petName, species, str(formData.get("breed"), 60), str(formData.get("sex"), 20), birth, str(formData.get("notes"), 500));
  revalidatePath("/pets");
  redirect(`/pets/${Number(r.lastInsertRowid)}`);
}

export async function setConsent(formData: FormData) {
  await requireLogin();
  const id = Number(formData.get("owner_id"));
  const consent = formData.get("consent") === "1" ? 1 : 0;
  db.prepare("UPDATE owners SET consent = ?, consent_at = ?, consent_note = ? WHERE id = ?").run(
    consent,
    consent ? new Date().toISOString() : null,
    consent ? consentSource(formData.get("consent_source")) : "",
    id,
  );
  revalidatePath("/", "layout");
}

export async function deletePet(formData: FormData) {
  await requireLogin();
  db.prepare("DELETE FROM pets WHERE id = ?").run(Number(formData.get("pet_id")));
  revalidatePath("/", "layout");
  redirect("/pets");
}

// ---------------- clinic records (entered by the veterinarian) ----------------

export async function addEntry(_prev: string | null, formData: FormData): Promise<string | null> {
  await requireLogin();
  const petId = Number(formData.get("pet_id"));
  if (!db.prepare("SELECT 1 FROM pets WHERE id = ?").get(petId)) return "Hasta bulunamadı.";
  const title = str(formData.get("title"), 120);
  if (!title) return "Başlık gerekli (örn. “Kısırlaştırma ameliyatı”).";
  const kind = ENTRY_KINDS.includes(str(formData.get("kind"), 20)) ? str(formData.get("kind"), 20) : "muayene";
  db.prepare("INSERT INTO entries (pet_id, done_on, kind, title, procedures, medications, notes, vet_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(
    petId,
    date(formData.get("done_on")),
    kind,
    title,
    str(formData.get("procedures"), 1000),
    str(formData.get("medications"), 1000),
    str(formData.get("notes"), 1000),
    str(formData.get("vet_name"), 80),
  );
  const dueRaw = str(formData.get("reminder_on"), 12);
  if (dueRaw) {
    const due = parseDateFlexible(dueRaw);
    if (!due) return "Hatırlatma tarihi geçersiz.";
    db.prepare("INSERT INTO reminders (pet_id, title, due_on) VALUES (?, ?, ?)").run(petId, str(formData.get("reminder_title"), 100) || title, due);
  }
  revalidatePath(`/pets/${petId}`);
  revalidatePath("/");
  return "OK:Kayıt eklendi.";
}

export async function deleteEntry(formData: FormData) {
  await requireLogin();
  const petId = Number(formData.get("pet_id"));
  db.prepare("DELETE FROM entries WHERE id = ? AND pet_id = ?").run(Number(formData.get("id")), petId);
  revalidatePath(`/pets/${petId}`);
}

export async function markReminderSent(formData: FormData) {
  await requireLogin();
  db.prepare("UPDATE reminders SET sent_at = datetime('now') WHERE id = ?").run(Number(formData.get("id")));
  revalidatePath("/");
}

export async function skipReminder(formData: FormData) {
  await requireLogin();
  db.prepare("DELETE FROM reminders WHERE id = ?").run(Number(formData.get("id")));
  revalidatePath("/");
}

// ---------------- care plans ----------------

export async function startPlan(formData: FormData) {
  await requireLogin();
  const petId = Number(formData.get("pet_id"));
  if (!db.prepare("SELECT 1 FROM pets WHERE id = ?").get(petId)) return;
  const start = date(formData.get("start_date"));
  const notes = str(formData.get("vet_notes"), 1000);
  const templateId = Number(formData.get("template_id")) || 0;
  let id: number | null = null;
  if (templateId) id = createPlanFromTemplate(petId, templateId, start, notes);
  if (!id) {
    const name = str(formData.get("name"), 100) || "Özel takip";
    const days = int(formData.get("days"), 1, 90, 7);
    id = createPlan({ petId, name, startDate: start, endDate: addDays(start, days - 1), vetNotes: notes, steps: [] });
  }
  revalidatePath("/", "layout");
  redirect(`/plans/${id}`);
}

export async function savePlanNotes(formData: FormData) {
  await requireLogin();
  const id = Number(formData.get("plan_id"));
  db.prepare("UPDATE care_plans SET vet_notes = ? WHERE id = ?").run(str(formData.get("vet_notes"), 1000), id);
  revalidatePath(`/plans/${id}`);
}

export async function setPlanStatus(formData: FormData) {
  await requireLogin();
  const id = Number(formData.get("plan_id"));
  db.prepare("UPDATE care_plans SET status = ? WHERE id = ?").run(formData.get("status") === "closed" ? "closed" : "active", id);
  revalidatePath("/", "layout");
}

export async function addMedication(_prev: string | null, formData: FormData): Promise<string | null> {
  await requireLogin();
  const planId = Number(formData.get("plan_id"));
  const plan = db.prepare("SELECT start_date FROM care_plans WHERE id = ?").get(planId) as { start_date: string } | undefined;
  if (!plan) return "Plan bulunamadı.";
  const name = str(formData.get("name"), 80);
  const dose = str(formData.get("dose_text"), 120);
  if (!name) return "İlaç adı gerekli.";
  if (!dose) return "Doz bilgisi gerekli (hekimin yazdığı şekilde).";
  const start = date(formData.get("start_date"), plan.start_date < today() ? today() : plan.start_date);
  const days = int(formData.get("days"), 1, 60, 5);
  const steps = expandMedication({ name, dose_text: dose, times_per_day: int(formData.get("times_per_day"), 1, 4, 2), days }, start);
  insertSteps(planId, steps);
  extendPlanTo(planId, steps[steps.length - 1].day_date);
  revalidatePath(`/plans/${planId}`);
  return "OK:İlaç plana eklendi.";
}

export async function addStep(_prev: string | null, formData: FormData): Promise<string | null> {
  await requireLogin();
  const planId = Number(formData.get("plan_id"));
  if (!db.prepare("SELECT 1 FROM care_plans WHERE id = ?").get(planId)) return "Plan bulunamadı.";
  const title = str(formData.get("title"), 120);
  if (!title) return "Başlık gerekli.";
  const kindRaw = str(formData.get("kind"), 20);
  const day = date(formData.get("day_date"));
  insertSteps(planId, [{ day_date: day, title, instructions: str(formData.get("instructions"), 300), kind: isStepKind(kindRaw) ? kindRaw : "task", sort: 50 }]);
  extendPlanTo(planId, day);
  revalidatePath(`/plans/${planId}`);
  return "OK:Adım eklendi.";
}

export async function deleteStep(formData: FormData) {
  await requireLogin();
  const planId = Number(formData.get("plan_id"));
  db.prepare("DELETE FROM care_steps WHERE id = ? AND plan_id = ?").run(Number(formData.get("id")), planId);
  revalidatePath(`/plans/${planId}`);
}

export async function reviewCheckin(formData: FormData) {
  await requireLogin();
  db.prepare("UPDATE checkins SET reviewed_at = datetime('now') WHERE id = ?").run(Number(formData.get("id")));
  revalidatePath("/", "layout");
}

// ---------------- templates and settings ----------------

export async function saveTemplate(_prev: string | null, formData: FormData): Promise<string | null> {
  await requireLogin();
  const id = Number(formData.get("id")) || 0;
  const name = str(formData.get("name"), 100);
  if (!name) return "Şablon adı gerekli.";
  const { steps, errors } = parseTemplateLines(str(formData.get("lines"), 20000));
  if (errors.length) return errors.slice(0, 3).join(" · ");
  if (steps.length === 0) return "En az bir adım girin (örn. 1-7 | Yara yerini kontrol et | | gözlem).";
  const days = Math.max(1, ...steps.map((s) => s.day_no));
  db.exec("BEGIN");
  try {
    let tid = id;
    if (tid) db.prepare("UPDATE plan_templates SET name = ?, description = ?, days = ? WHERE id = ?").run(name, str(formData.get("description"), 200), days, tid);
    else tid = Number(db.prepare("INSERT INTO plan_templates (name, description, days) VALUES (?, ?, ?)").run(name, str(formData.get("description"), 200), days).lastInsertRowid);
    db.prepare("DELETE FROM template_steps WHERE template_id = ?").run(tid);
    const ins = db.prepare("INSERT INTO template_steps (template_id, day_no, title, instructions, kind) VALUES (?, ?, ?, ?, ?)");
    for (const s of steps) ins.run(tid, s.day_no, s.title, s.instructions, s.kind);
    db.exec("COMMIT");
  } catch {
    db.exec("ROLLBACK");
    return "Kaydedilemedi (aynı adda başka bir şablon olabilir).";
  }
  revalidatePath("/templates");
  return "OK:Kaydedildi.";
}

export async function deleteTemplate(formData: FormData) {
  await requireLogin();
  db.prepare("DELETE FROM plan_templates WHERE id = ?").run(Number(formData.get("id")));
  revalidatePath("/templates");
}

export async function saveSettings(formData: FormData) {
  await requireLogin();
  const name = str(formData.get("clinic_name"), 60);
  if (name) setSetting("clinic_name", name);
  const phone = str(formData.get("clinic_phone"), 30);
  setSetting("clinic_phone", phone);
  revalidatePath("/", "layout");
}

// ---------------- public: owner, through the private plan link ----------------

function planByToken(token: string) {
  return db.prepare("SELECT id, start_date, end_date, status FROM care_plans WHERE token = ?").get(token) as
    | { id: number; start_date: string; end_date: string; status: string }
    | undefined;
}

export async function toggleStep(formData: FormData) {
  const token = str(formData.get("token"), 40);
  const plan = planByToken(token);
  if (!plan || plan.status !== "active") return;
  const stepId = Number(formData.get("step_id"));
  const step = db.prepare("SELECT id, day_date, done_at FROM care_steps WHERE id = ? AND plan_id = ?").get(stepId, plan.id) as
    | { id: number; day_date: string; done_at: string | null }
    | undefined;
  if (!step || step.day_date > today()) return; // future steps cannot be ticked off
  db.prepare("UPDATE care_steps SET done_at = ? WHERE id = ?").run(step.done_at ? null : new Date().toISOString(), step.id);
  revalidatePath(`/p/${token}`);
  revalidatePath("/");
}

export async function submitCheckin(_prev: string | null, formData: FormData): Promise<string | null> {
  const token = str(formData.get("token"), 40);
  const plan = planByToken(token);
  if (!plan) return "Bu bağlantı geçerli değil.";
  if (plan.status !== "active") return "Bu takip kapatılmış. Sorularınız için kliniği arayın.";
  const day = date(formData.get("day_date"));
  if (day > today() || day < plan.start_date) return "Bu gün için not eklenemez.";
  const tempRaw = str(formData.get("temp"), 6).replace(",", ".");
  let temp: number | null = null;
  if (tempRaw) {
    temp = Number(tempRaw);
    if (!Number.isFinite(temp) || temp < 30 || temp > 45) return "Ateş değeri geçersiz (örn. 38.5). Bilmiyorsanız boş bırakın.";
  }
  db.prepare(
    `INSERT INTO checkins (plan_id, day_date, appetite, water, energy, vomiting, worried, temp, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(plan_id, day_date) DO UPDATE SET appetite = excluded.appetite, water = excluded.water, energy = excluded.energy,
       vomiting = excluded.vomiting, worried = excluded.worried, temp = excluded.temp, note = excluded.note,
       updated_at = datetime('now'), reviewed_at = NULL`,
  ).run(
    plan.id,
    day,
    int(formData.get("appetite"), 0, 2, 2),
    int(formData.get("water"), 0, 2, 2),
    int(formData.get("energy"), 0, 2, 2),
    int(formData.get("vomiting"), 0, 9, 0),
    formData.get("worried") === "on" ? 1 : 0,
    temp,
    str(formData.get("note"), 600),
  );
  revalidatePath("/");
  redirect(`/p/${token}?ok=1`);
}
