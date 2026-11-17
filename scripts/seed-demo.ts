// Fills a SEPARATE demo database with clearly fictional patients (for screenshots / demos).
// Usage: CLINIC_DATA_DIR=./data-demo npm run seed:demo
import crypto from "node:crypto";
import { db, setSetting } from "../lib/db.ts";
import { addDays, today } from "../lib/dates.ts";
import { createPlanFromTemplate, insertSteps, extendPlanTo } from "../lib/planops.ts";
import { expandMedication } from "../lib/care.ts";

if (!process.env.CLINIC_DATA_DIR) {
  console.error("Refusing to seed: set CLINIC_DATA_DIR so the real database is never touched.");
  process.exit(1);
}

const t = today();
const ago = (n: number) => addDays(t, -n);
const consentAt = () => new Date(Date.now() - 12 * 86400000).toISOString();

setSetting("clinic_name", "Pati Veteriner Kliniği");
setSetting("clinic_phone", "0212 000 00 00");

const owner = db.prepare("INSERT INTO owners (name, phone, consent, consent_at, consent_note) VALUES (?, ?, ?, ?, ?)");
const pet = db.prepare("INSERT INTO pets (owner_id, name, species, breed, sex, birth_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?)");
const entry = db.prepare("INSERT INTO entries (pet_id, done_on, kind, title, procedures, medications, notes, vet_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
const reminder = db.prepare("INSERT INTO reminders (pet_id, title, due_on) VALUES (?, ?, ?)");
const checkin = db.prepare(
  "INSERT INTO checkins (plan_id, day_date, appetite, water, energy, vomiting, worried, temp, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
);
const tpl = (name: string) => (db.prepare("SELECT id FROM plan_templates WHERE name LIKE ?").get(name + "%") as { id: number }).id;
const id = (r: { lastInsertRowid: number | bigint }) => Number(r.lastInsertRowid);

// 1) Dog, post-surgery plan, day 4: yesterday's note worrying (unreviewed alert), today's note missing.
const o1 = id(owner.run("Ayşe Yılmaz", "905320000001", 1, consentAt(), "sözlü"));
const bal = id(pet.run(o1, "Bal", "köpek", "Golden Retriever", "dişi", ago(365 * 3 + 40), "Penisilin alerjisi şüphesi, hekim notu."));
entry.run(bal, ago(3), "ameliyat", "Kısırlaştırma ameliyatı", "Ovariohisterektomi", "Hekimin yazdığı ağrı kesici ve antibiyotik kürü (plana işlendi)", "Anestezi sorunsuz.", "Dr. Elif Kaya");
const p1 = createPlanFromTemplate(bal, tpl("Ameliyat sonrası"), ago(3), "Yaka çıkarılmasın. Dikiş yerinde akıntı olursa hemen arayın.")!;
const med1 = expandMedication({ name: "Antibiyotik (hekim yazdı)", dose_text: "1 tablet, tok karnına", times_per_day: 2, days: 7 }, ago(3));
insertSteps(p1, med1);
extendPlanTo(p1, med1[med1.length - 1].day_date);
db.prepare("UPDATE care_steps SET done_at = ? WHERE plan_id = ? AND day_date < ?").run(new Date().toISOString(), p1, t);
checkin.run(p1, ago(3), 2, 2, 1, 0, 0, 38.6, "Uykulu ama su içti.");
checkin.run(p1, ago(2), 2, 2, 2, 0, 0, null, "Daha hareketli.");
checkin.run(p1, ago(1), 0, 1, 0, 2, 1, 39.4, "Akşam iki kez kustu, hiç yemek yemedi. Endişeliyim.");
reminder.run(bal, "Dikiş kontrolü", addDays(t, 6));

// 2) Cat, 7-day observation, doing fine, today's note in.
const o2 = id(owner.run("Mehmet Demir", "905320000002", 1, consentAt(), "yazılı / WhatsApp"));
const misket = id(pet.run(o2, "Minnoş", "kedi", "Tekir", "erkek", ago(365 * 6), ""));
entry.run(misket, ago(2), "muayene", "İştahsızlık şikayeti", "Genel muayene, kan tahlili", "", "Bir hafta gözlem istendi.", "Dr. Elif Kaya");
const p2 = createPlanFromTemplate(misket, tpl("Genel gözlem"), ago(2), "Yemek yeme ve su içme durumunu özellikle not edin.")!;
checkin.run(p2, ago(2), 1, 2, 2, 0, 0, null, "Az yedi.");
checkin.run(p2, ago(1), 2, 2, 2, 0, 0, 38.4, "Normal yedi.");
checkin.run(p2, t, 2, 2, 2, 0, 0, null, "Bugün çok hareketli.");
db.prepare("UPDATE care_steps SET done_at = ? WHERE plan_id = ? AND day_date < ?").run(new Date().toISOString(), p2, t);

// 3) Dog, stomach issue, no note yet today.
const o3 = id(owner.run("Zeynep Arslan", "905320000003", 1, consentAt(), "sözlü"));
const pamuk = id(pet.run(o3, "Pamuk", "köpek", "Pomeranian", "dişi", ago(365 * 2), ""));
entry.run(pamuk, ago(1), "tedavi", "Mide-bağırsak şikayeti", "Serum, muayene", "Hekimin yazdığı mide koruyucu (plana işlendi)", "", "Dr. Elif Kaya");
const p3 = createPlanFromTemplate(pamuk, tpl("Mide-bağırsak"), ago(1), "")!;
const med3 = expandMedication({ name: "Mide koruyucu (hekim yazdı)", dose_text: "yarım ölçek, yemekten önce", times_per_day: 2, days: 4 }, ago(1));
insertSteps(p3, med3);
checkin.run(p3, ago(1), 1, 2, 1, 1, 0, null, "Bir kez kustu.");

// 4) Reminders and records without plans.
const o4 = id(owner.run("Can Öztürk", "905320000004", 0, null, ""));
const pasa = id(pet.run(o4, "Paşa", "kedi", "British Shorthair", "erkek", ago(200), ""));
entry.run(pasa, ago(20), "aşı", "Karma aşı", "Birinci doz", "", "", "Dr. Elif Kaya");
reminder.run(pasa, "Karma aşı tekrar dozu", addDays(t, 1));
const o5 = id(owner.run("Selin Aydın", "905320000005", 1, consentAt(), "form / imza"));
const tarcin = id(pet.run(o5, "Tarçın", "tavşan", "", "dişi", ago(500), ""));
entry.run(tarcin, ago(30), "muayene", "Yıllık kontrol", "Diş ve tırnak kontrolü", "", "", "Dr. Elif Kaya");
reminder.run(tarcin, "Yıllık kontrol", addDays(t, 4));
const o6 = id(owner.run("Burak Şahin", "905320000006", 1, consentAt(), "sözlü"));
pet.run(o6, "Karabaş", "köpek", "Kangal", "erkek", ago(365 * 5), "");

console.log("Demo data written to", process.env.CLINIC_DATA_DIR, "token sample:", crypto.randomBytes(1).length ? "ok" : "");
