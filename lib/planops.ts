// Plan creation helpers that only need the database (no Next.js imports), so scripts can use them too.
import crypto from "node:crypto";
import { db, plain } from "./db.ts";
import { expandTemplate, planEnd, type PlanStep, type TemplateStep } from "./care.ts";

export function insertSteps(planId: number, steps: PlanStep[]) {
  const ins = db.prepare("INSERT INTO care_steps (plan_id, day_date, title, instructions, kind, sort) VALUES (?, ?, ?, ?, ?, ?)");
  for (const s of steps) ins.run(planId, s.day_date, s.title, s.instructions, s.kind, s.sort);
}

export function createPlan(opts: { petId: number; name: string; startDate: string; endDate: string; vetNotes: string; steps: PlanStep[] }): number {
  const token = crypto.randomBytes(14).toString("base64url");
  const id = Number(
    db
      .prepare("INSERT INTO care_plans (pet_id, name, start_date, end_date, token, vet_notes) VALUES (?, ?, ?, ?, ?, ?)")
      .run(opts.petId, opts.name, opts.startDate, opts.endDate, token, opts.vetNotes).lastInsertRowid,
  );
  insertSteps(id, opts.steps);
  return id;
}

export function createPlanFromTemplate(petId: number, templateId: number, startDate: string, vetNotes: string): number | null {
  const t = db.prepare("SELECT * FROM plan_templates WHERE id = ?").get(templateId) as { id: number; name: string; days: number } | undefined;
  if (!t) return null;
  const steps = plain<TemplateStep>(db.prepare("SELECT day_no, title, instructions, kind FROM template_steps WHERE template_id = ? ORDER BY day_no, id").all(t.id));
  return createPlan({
    petId,
    name: t.name,
    startDate,
    endDate: planEnd(steps, startDate, t.days),
    vetNotes,
    steps: expandTemplate(steps, startDate),
  });
}

/** Extends the plan so its last day covers newly added steps. */
export function extendPlanTo(planId: number, date: string) {
  db.prepare("UPDATE care_plans SET end_date = ? WHERE id = ? AND end_date < ?").run(date, planId, date);
}
