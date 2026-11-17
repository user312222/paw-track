// Pure care-plan logic: plan expansion, medication schedules, check-in concern rules, templates text.
// No imports from the database so it can be unit-tested directly.
import { addDays, daysBetween } from "./dates.ts";

export type StepKind = "task" | "observe" | "medication";
export const STEP_KINDS: { id: StepKind; label: string }[] = [
  { id: "task", label: "Yapılacak" },
  { id: "observe", label: "Gözlem" },
  { id: "medication", label: "İlaç" },
];
export const isStepKind = (v: string): v is StepKind => STEP_KINDS.some((k) => k.id === v);

export type TemplateStep = { day_no: number; title: string; instructions: string; kind: StepKind };
export type PlanStep = { day_date: string; title: string; instructions: string; kind: StepKind; sort: number };

/** Template day numbers start at 1 = plan start date. */
export function expandTemplate(steps: TemplateStep[], startDate: string): PlanStep[] {
  return steps
    .filter((s) => s.day_no >= 1)
    .map((s, i) => ({ day_date: addDays(startDate, s.day_no - 1), title: s.title, instructions: s.instructions, kind: s.kind, sort: i }));
}

export function planEnd(steps: TemplateStep[], startDate: string, fallbackDays: number): string {
  const last = steps.reduce((m, s) => Math.max(m, s.day_no), 0);
  return addDays(startDate, Math.max(last, fallbackDays, 1) - 1);
}

const SLOTS: Record<number, string[]> = {
  1: ["gün içinde"],
  2: ["sabah", "akşam"],
  3: ["sabah", "öğle", "akşam"],
  4: ["sabah", "öğle", "akşam", "gece"],
};

/** One step per dose. Dose text is whatever the vet typed; the app never computes or suggests doses. */
export function expandMedication(
  m: { name: string; dose_text: string; times_per_day: number; days: number },
  startDate: string,
): PlanStep[] {
  const times = Math.min(4, Math.max(1, Math.floor(m.times_per_day) || 1));
  const days = Math.min(60, Math.max(1, Math.floor(m.days) || 1));
  const out: PlanStep[] = [];
  for (let d = 0; d < days; d++) {
    for (let t = 0; t < times; t++) {
      out.push({
        day_date: addDays(startDate, d),
        title: `İlaç: ${m.name}`,
        instructions: [m.dose_text.trim(), SLOTS[times][t]].filter(Boolean).join(" · "),
        kind: "medication",
        sort: 100 + t,
      });
    }
  }
  return out;
}

export type Checkin = { appetite: number; water: number; energy: number; vomiting: number; worried: number; temp: number | null };

export const LEVELS = [
  { v: 0, label: "Hiç" },
  { v: 1, label: "Az" },
  { v: 2, label: "Normal" },
];

/** Reasons the clinic should look at a check-in. Deliberately simple and transparent; the vet decides what they mean. */
export function concernReasons(c: Checkin): string[] {
  const r: string[] = [];
  if (c.appetite === 0) r.push("hiç yemedi");
  if (c.water === 0) r.push("su içmedi");
  if (c.energy === 0) r.push("çok halsiz");
  if (c.vomiting > 0) r.push(c.vomiting === 1 ? "kustu" : `${c.vomiting} kez kustu`);
  if (c.worried) r.push("sahibi endişeli");
  return r;
}

export type DayStatus = "alert" | "watch" | "ok" | "missing" | "future";

/** One word per plan day for the trend strip: red = warning sign, amber = low appetite/water/energy or any vomiting. */
export function dayStatus(c: Checkin | undefined, isFuture: boolean): DayStatus {
  if (isFuture) return "future";
  if (!c) return "missing";
  if (concernReasons(c).length > 0) return "alert";
  if (c.appetite === 1 || c.water === 1 || c.energy === 1) return "watch";
  return "ok";
}

export function planDay(startDate: string, date: string): number {
  return daysBetween(startDate, date) + 1;
}

/** Lines of the form: gün | başlık | açıklama (opsiyonel) | tür (yapılacak/gözlem/ilaç, opsiyonel) */
export function parseTemplateLines(text: string): { steps: TemplateStep[]; errors: string[] } {
  const steps: TemplateStep[] = [];
  const errors: string[] = [];
  const kinds: Record<string, StepKind> = { yapılacak: "task", yapilacak: "task", gözlem: "observe", gozlem: "observe", ilaç: "medication", ilac: "medication" };
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    const parts = line.split("|").map((p) => p.trim());
    const dayText = parts[0];
    const range = /^(\d{1,3})\s*-\s*(\d{1,3})$/.exec(dayText);
    const from = range ? Number(range[1]) : Number(dayText);
    const to = range ? Number(range[2]) : from;
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from || to > 90) {
      errors.push(`Satır ${i + 1}: gün sayısı geçersiz`);
      return;
    }
    if (!parts[1]) {
      errors.push(`Satır ${i + 1}: başlık gerekli`);
      return;
    }
    const kind = kinds[(parts[3] ?? "").toLocaleLowerCase("tr-TR")] ?? "task";
    for (let d = from; d <= to; d++) steps.push({ day_no: d, title: parts[1].slice(0, 120), instructions: (parts[2] ?? "").slice(0, 300), kind });
  });
  return { steps, errors };
}

export function templateToLines(steps: TemplateStep[]): string {
  const kindLabel: Record<StepKind, string> = { task: "yapılacak", observe: "gözlem", medication: "ilaç" };
  return steps.map((s) => `${s.day_no} | ${s.title} | ${s.instructions} | ${kindLabel[s.kind]}`).join("\n");
}

// ---- WhatsApp messages (a person sends them; nothing is sent automatically) ----

export function planInviteMessage(v: { owner: string; pet: string; clinic: string; plan: string; link: string }): string {
  const first = v.owner.split(" ")[0];
  return `Merhaba ${first}, ${v.clinic} olarak yazıyoruz. ${v.pet} için "${v.plan}" takibini başlattık. Her gün yapılacakları görmek ve ${v.pet}'in durumunu not etmek için bu bağlantıyı kullanabilirsiniz: ${v.link}`;
}

export function missingCheckinMessage(v: { owner: string; pet: string; clinic: string; link: string }): string {
  const first = v.owner.split(" ")[0];
  return `Merhaba ${first}, ${v.clinic} olarak yazıyoruz. ${v.pet} için bugünkü notu henüz göremedik. Kısaca durumunu işaretleyebilir misiniz? ${v.link}`;
}

export function controlReminderMessage(v: { owner: string; pet: string; clinic: string; title: string; dueOn: string }): string {
  const first = v.owner.split(" ")[0];
  return `Merhaba ${first}, ${v.clinic} olarak yazıyoruz. ${v.pet} için "${v.title}" zamanı ${v.dueOn} tarihinde. Uygun bir gün için bize dönebilirsiniz.`;
}
