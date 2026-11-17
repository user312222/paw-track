import test from "node:test";
import assert from "node:assert/strict";
import { addDays, ageText, dayOf, daysBetween, normalizePhone, parseDateFlexible } from "../lib/dates.ts";
import { concernReasons, dayStatus, expandMedication, expandTemplate, parseTemplateLines, planDay, planEnd, templateToLines } from "../lib/care.ts";
import { lockedForSeconds, recordFailure, resetThrottle } from "../lib/ratelimit.ts";

test("dayOf uses the clinic time zone, not UTC", () => {
  const lateUtc = new Date("2026-11-17T22:30:00Z"); // 01:30 on the 18th in Istanbul
  assert.equal(dayOf(lateUtc, "Europe/Istanbul"), "2026-11-18");
  assert.equal(dayOf(lateUtc, "UTC"), "2026-11-17");
});

test("date helpers", () => {
  assert.equal(addDays("2026-12-30", 3), "2027-01-02");
  assert.equal(daysBetween("2026-11-10", "2026-11-17"), 7);
  assert.equal(parseDateFlexible("5.10.2026"), "2026-10-05");
  assert.equal(parseDateFlexible("31.02.2026"), null);
  assert.equal(normalizePhone("0532 123 45 67"), "905321234567");
  assert.equal(normalizePhone("12"), null);
});

test("ageText", () => {
  assert.equal(ageText("2026-11-10", "2026-11-17"), "7 günlük");
  assert.equal(ageText("2026-05-17", "2026-11-17"), "6 aylık");
  assert.equal(ageText("2022-11-17", "2026-11-17"), "4 yaşında");
  assert.equal(ageText(null, "2026-11-17"), "");
});

test("expandTemplate maps day numbers to dates from the start date", () => {
  const out = expandTemplate(
    [
      { day_no: 1, title: "A", instructions: "", kind: "task" },
      { day_no: 3, title: "B", instructions: "x", kind: "observe" },
    ],
    "2026-11-17",
  );
  assert.deepEqual(out.map((s) => s.day_date), ["2026-11-17", "2026-11-19"]);
  assert.equal(planEnd([{ day_no: 10, title: "", instructions: "", kind: "task" }], "2026-11-17", 7), "2026-11-26");
  assert.equal(planDay("2026-11-17", "2026-11-19"), 3);
});

test("expandMedication creates one step per dose with slot labels and keeps the vet's dose text verbatim", () => {
  const out = expandMedication({ name: "İlaç X", dose_text: "yarım tablet", times_per_day: 2, days: 3 }, "2026-11-17");
  assert.equal(out.length, 6);
  assert.equal(out[0].instructions, "yarım tablet · sabah");
  assert.equal(out[1].instructions, "yarım tablet · akşam");
  assert.equal(out[5].day_date, "2026-11-19");
  assert.ok(out.every((s) => s.kind === "medication"));
  // clamps silly input
  assert.equal(expandMedication({ name: "Y", dose_text: "", times_per_day: 99, days: 999 }, "2026-11-17").length, 4 * 60);
});

test("concernReasons flags only clear warning signs", () => {
  const ok = { appetite: 2, water: 2, energy: 2, vomiting: 0, worried: 0, temp: null };
  assert.deepEqual(concernReasons(ok), []);
  assert.deepEqual(concernReasons({ ...ok, appetite: 1, energy: 1 }), []);
  assert.deepEqual(concernReasons({ ...ok, appetite: 0, vomiting: 3, worried: 1 }), ["hiç yemedi", "3 kez kustu", "sahibi endişeli"]);
});

test("dayStatus classifies days for the trend strip", () => {
  const ok = { appetite: 2, water: 2, energy: 2, vomiting: 0, worried: 0, temp: null };
  assert.equal(dayStatus(ok, true), "future");
  assert.equal(dayStatus(undefined, false), "missing");
  assert.equal(dayStatus(ok, false), "ok");
  assert.equal(dayStatus({ ...ok, appetite: 1 }, false), "watch");
  assert.equal(dayStatus({ ...ok, vomiting: 1 }, false), "alert");
  assert.equal(dayStatus({ ...ok, energy: 0 }, false), "alert");
});

test("parseTemplateLines supports ranges, kinds and reports errors", () => {
  const { steps, errors } = parseTemplateLines("1-3 | Dikiş yerini kontrol et | kızarıklık, akıntı | gözlem\n5 | Kontrol randevusu\nx | Hatalı\n2 |  | başlıksız");
  assert.equal(steps.length, 4);
  assert.equal(steps[0].kind, "observe");
  assert.equal(steps[3].kind, "task");
  assert.equal(steps[3].day_no, 5);
  assert.equal(errors.length, 2);
  // round trip
  assert.equal(parseTemplateLines(templateToLines(steps)).steps.length, 4);
});

test("login throttle still works", () => {
  resetThrottle();
  for (let i = 0; i < 5; i++) recordFailure("k", i);
  assert.ok(lockedForSeconds("k", 10) > 0);
});
