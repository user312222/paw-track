import { headers } from "next/headers";
import { db, plain, type Plan, type Step } from "./db";
import { addDays, today } from "./dates";

export { createPlan, createPlanFromTemplate, extendPlanTo, insertSteps } from "./planops";

export type PlanRow = Plan & { pet_name: string; species: string; owner_id: number; owner_name: string; phone: string; consent: number };

const PLAN_SELECT = `
  SELECT p.*, pt.name AS pet_name, pt.species, o.id AS owner_id, o.name AS owner_name, o.phone, o.consent
  FROM care_plans p JOIN pets pt ON pt.id = p.pet_id JOIN owners o ON o.id = pt.owner_id`;

export function getPlan(id: number): PlanRow | undefined {
  const r = db.prepare(PLAN_SELECT + " WHERE p.id = ?").get(id);
  return r ? ({ ...r } as unknown as PlanRow) : undefined;
}

export function getPlanByToken(token: string): PlanRow | undefined {
  const r = db.prepare(PLAN_SELECT + " WHERE p.token = ?").get(token);
  return r ? ({ ...r } as unknown as PlanRow) : undefined;
}

export type ActivePlan = PlanRow & { steps_today: number; done_today: number; checked_in_today: number; ended: boolean };

export function activePlans(): ActivePlan[] {
  const t = today();
  const rows = plain<PlanRow & { steps_today: number; done_today: number; checked_in_today: number }>(
    db
      .prepare(
        `${PLAN_SELECT.replace("SELECT p.*,", `SELECT p.*,
           (SELECT COUNT(*) FROM care_steps s WHERE s.plan_id = p.id AND s.day_date = ?1) AS steps_today,
           (SELECT COUNT(*) FROM care_steps s WHERE s.plan_id = p.id AND s.day_date = ?1 AND s.done_at IS NOT NULL) AS done_today,
           (SELECT COUNT(*) FROM checkins c WHERE c.plan_id = p.id AND c.day_date = ?1) AS checked_in_today,`)}
         WHERE p.status = 'active' ORDER BY p.end_date, pt.name`,
      )
      .all(t),
  );
  return rows.map((r) => ({ ...r, ended: r.end_date < t }));
}

export type AlertRow = {
  id: number; plan_id: number; day_date: string; appetite: number; water: number; energy: number; vomiting: number; worried: number;
  temp: number | null; note: string; species: string; pet_name: string; owner_name: string; phone: string; plan_name: string; pet_id: number;
};

export function unreviewedAlerts(): AlertRow[] {
  return plain<AlertRow>(
    db
      .prepare(
        `SELECT c.*, pt.id AS pet_id, pt.species, pt.name AS pet_name, o.name AS owner_name, o.phone, p.name AS plan_name
         FROM checkins c JOIN care_plans p ON p.id = c.plan_id JOIN pets pt ON pt.id = p.pet_id JOIN owners o ON o.id = pt.owner_id
         WHERE c.reviewed_at IS NULL AND (c.appetite = 0 OR c.water = 0 OR c.energy = 0 OR c.vomiting > 0 OR c.worried = 1)
         ORDER BY c.day_date DESC, c.updated_at DESC`,
      )
      .all(),
  );
}

export type ReminderRow = { id: number; pet_id: number; title: string; due_on: string; sent_at: string | null; pet_name: string; owner_name: string; phone: string; consent: number };

export function dueReminders(withinDays = 7): ReminderRow[] {
  return plain<ReminderRow>(
    db
      .prepare(
        `SELECT r.*, pt.name AS pet_name, o.name AS owner_name, o.phone, o.consent
         FROM reminders r JOIN pets pt ON pt.id = r.pet_id JOIN owners o ON o.id = pt.owner_id
         WHERE r.sent_at IS NULL AND r.due_on <= ? ORDER BY r.due_on`,
      )
      .all(addDays(today(), withinDays)),
  );
}

export function planSteps(planId: number): Step[] {
  return plain<Step>(db.prepare("SELECT * FROM care_steps WHERE plan_id = ? ORDER BY day_date, kind = 'medication', sort, id").all(planId));
}

export async function baseUrl(): Promise<string> {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

export function waLink(phone: string, message: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
