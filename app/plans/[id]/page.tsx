import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireLogin } from "@/lib/auth";
import { db, getSetting, plain, type CheckinRow } from "@/lib/db";
import { concernReasons, dayStatus, LEVELS, planInviteMessage } from "@/lib/care";
import { baseUrl, getPlan, planSteps, waLink } from "@/lib/plans";
import { addDays, daysBetween, formatDateTR, today, weekdayTR } from "@/lib/dates";
import { deleteStep, reviewCheckin, savePlanNotes, setPlanStatus } from "../../actions";
import { MedicationForm, StepForm } from "../../forms";
import { Icon, PetAvatar } from "../../ui";

const level = (v: number) => LEVELS.find((l) => l.v === v)?.label ?? String(v);

function CheckinCard({ c, startDate, phone }: { c: CheckinRow; startDate: string; phone: string }) {
  const reasons = concernReasons(c);
  const open = reasons.length > 0 && !c.reviewed_at;
  return (
    <div className={open ? "card alert" : "card"}>
      <div className="reminder-top">
        <div>
          <strong>{formatDateTR(c.day_date)}</strong>{" "}
          <span className="muted">{weekdayTR(c.day_date)} · {daysBetween(startDate, c.day_date) + 1}. gün</span>
        </div>
        <div className="actions">
          {reasons.map((r) => <span className="tag bad" key={r}>{r}</span>)}
          {c.reviewed_at && reasons.length > 0 && <span className="tag ok"><Icon name="check" size={13} /> görüldü</span>}
        </div>
      </div>
      <div className="actions" style={{ margin: "10px 0 0" }}>
        <span className="tag">yemek: {level(c.appetite)}</span>
        <span className="tag">su: {level(c.water)}</span>
        <span className="tag">enerji: {level(c.energy)}</span>
        {c.vomiting > 0 && <span className="tag bad">kusma: {c.vomiting}</span>}
        {c.temp !== null && <span className="tag">ateş: {c.temp}°</span>}
      </div>
      {c.note && <p className="mono-note" style={{ margin: "10px 0 0" }}>“{c.note}”</p>}
      {open && (
        <div className="actions" style={{ marginTop: 12 }}>
          <a className="btn" href={`tel:+${phone}`}><Icon name="phone" size={16} /> Sahibi ara</a>
          <form action={reviewCheckin}>
            <input type="hidden" name="id" value={c.id} />
            <button className="primary"><Icon name="check" size={16} /> Görüldü</button>
          </form>
        </div>
      )}
    </div>
  );
}

export default async function PlanPage({ params }: PageProps<"/plans/[id]">) {
  await requireLogin();
  const { id } = await params;
  const plan = getPlan(Number(id));
  if (!plan) notFound();
  const steps = planSteps(plan.id);
  const checkins = plain<CheckinRow>(db.prepare("SELECT * FROM checkins WHERE plan_id = ? ORDER BY day_date DESC").all(plan.id));
  const byDate = new Map(checkins.map((c) => [c.day_date, c]));
  const t = today();
  const base = await baseUrl();
  const link = `${base}/p/${plan.token}`;
  const clinic = getSetting("clinic_name", "Kliniğimiz");
  const invite = planInviteMessage({ owner: plan.owner_name, pet: plan.pet_name, clinic, plan: plan.name, link });
  const total = daysBetween(plan.start_date, plan.end_date) + 1;
  const day = Math.min(total, Math.max(0, daysBetween(plan.start_date, t) + 1));

  const byDay = new Map<string, typeof steps>();
  for (const s of steps) byDay.set(s.day_date, [...(byDay.get(s.day_date) ?? []), s]);
  const doneCount = steps.filter((s) => s.done_at).length;
  const pct = steps.length ? Math.round((doneCount / steps.length) * 100) : 0;
  const openAlerts = checkins.filter((c) => !c.reviewed_at && concernReasons(c).length > 0).length;
  const medNames = new Set(steps.filter((s) => s.kind === "medication").map((s) => s.title));

  const days = Array.from({ length: total }, (_, i) => addDays(plan.start_date, i));
  const todayHasForms = t < plan.start_date ? plan.start_date : t;

  return (
    <>
      <div className="page-head">
        <div className="who" style={{ gap: 16 }}>
          <PetAvatar species={plan.species} large />
          <div>
            <div className="eyebrow">Takip planı</div>
            <h1>{plan.name}</h1>
            <p className="sub">
              <Link href={`/pets/${plan.pet_id}`}>{plan.pet_name}</Link> · {plan.owner_name} · {formatDateTR(plan.start_date)} – {formatDateTR(plan.end_date)}
            </p>
          </div>
        </div>
        <div className="actions">
          <span className={plan.status === "active" ? "tag accent" : "tag"}>{plan.status === "active" ? "aktif" : "kapandı"}</span>
          <form action={setPlanStatus}>
            <input type="hidden" name="plan_id" value={plan.id} />
            <input type="hidden" name="status" value={plan.status === "active" ? "closed" : "active"} />
            <button>{plan.status === "active" ? "Takibi kapat" : "Yeniden aç"}</button>
          </form>
        </div>
      </div>

      <div className="plan-summary">
        <div className="ring lg" style={{ "--p": pct } as CSSProperties} title="Tamamlanan adımlar"><span>%{pct}</span></div>
        <div className="facts">
          <div className="fact"><b>{day}/{total}</b><span>gün</span></div>
          <div className="fact"><b>{doneCount}/{steps.length}</b><span>adım yapıldı</span></div>
          <div className="fact"><b>{checkins.length}</b><span>sahip notu</span></div>
          <div className={openAlerts ? "fact bad" : "fact"}><b>{openAlerts}</b><span>bekleyen uyarı</span></div>
        </div>
      </div>

      <div className="section-title"><h2>Seyir</h2></div>
      <div className="card">
        <div className="trend" role="list" aria-label="Günlük durum şeridi">
          {days.map((d, i) => {
            const st = dayStatus(byDate.get(d), d > t);
            const names = { ok: "iyi", watch: "dikkat", alert: "uyarı", missing: "not yok", future: "henüz değil" } as const;
            return (
              <a className={d === t ? "trend-day today" : "trend-day"} key={d} href={`#gun-${i + 1}`} role="listitem" title={`${formatDateTR(d)} · ${names[st]}`}>
                <span className={`dot ${st}`}>{st === "ok" ? <Icon name="check" size={13} /> : st === "alert" ? "!" : ""}</span>
                {i + 1}
              </a>
            );
          })}
        </div>
        <div className="legend">
          <span><i style={{ background: "var(--ok)" }} />iyi</span>
          <span><i style={{ background: "#e0a030" }} />düşük iştah/su/enerji</span>
          <span><i style={{ background: "var(--bad)" }} />uyarı</span>
          <span><i style={{ border: "2px dashed var(--bad)" }} />not girilmedi</span>
        </div>
      </div>

      <div className="section-title"><h2>Sahibin notları</h2><span className="count">{checkins.length}</span></div>
      {checkins.length === 0 ? (
        <div className="card empty"><strong>Henüz not girilmedi</strong>Sahip bağlantıdan her gün durumu işaretleyecek.</div>
      ) : (
        <>
          {checkins.slice(0, 2).map((c) => <CheckinCard key={c.id} c={c} startDate={plan.start_date} phone={plan.phone} />)}
          {checkins.length > 2 && (
            <details className="disclosure">
              <summary><span className="btn ghost">Önceki {checkins.length - 2} not</span></summary>
              {checkins.slice(2).map((c) => <CheckinCard key={c.id} c={c} startDate={plan.start_date} phone={plan.phone} />)}
            </details>
          )}
        </>
      )}

      <div className="section-title"><h2>Gün gün plan</h2><span className="count">{doneCount}/{steps.length} yapıldı</span></div>
      {steps.length === 0 && <div className="card empty"><strong>Plan boş</strong>Aşağıdan ilaç veya adım ekleyin.</div>}
      {days.filter((d) => byDay.has(d)).map((date) => {
        const list = byDay.get(date)!;
        const done = list.filter((s) => s.done_at).length;
        const n = daysBetween(plan.start_date, date) + 1;
        const isOpen = date >= t && date <= addDays(t, 1);
        return (
          <details className={`daycard${date === t ? " today" : ""}${done === list.length ? " alldone" : ""}`} id={`gun-${n}`} key={date} open={isOpen}>
            <summary>
              <div>
                <div className="day-title">{n}. gün{date === t ? " · bugün" : ""}</div>
                <div className="day-sub">{formatDateTR(date)} · {weekdayTR(date)}</div>
              </div>
              <div className="progress" style={{ marginLeft: "auto" }}><i style={{ width: `${(done / list.length) * 100}%` }} /></div>
              <span className="tag">{done}/{list.length}</span>
            </summary>
            <div className="steps">
              {list.map((s) => (
                <div className={s.done_at ? "step done" : "step"} key={s.id}>
                  <span className={s.done_at ? "check-btn on btn" : "check-btn btn"} aria-hidden="true" style={{ display: "grid", placeItems: "center" }}>
                    {s.done_at ? <Icon name="check" size={16} /> : null}
                  </span>
                  <div>
                    <div className="step-title">{s.title}</div>
                    {s.instructions && <div className="muted">{s.instructions}</div>}
                  </div>
                  <div className="step-meta">
                    {s.kind === "medication" && <span className="tag kind-med"><Icon name="pill" size={12} /> ilaç</span>}
                    {s.kind === "observe" && <span className="tag kind-obs">gözlem</span>}
                    <form action={deleteStep}>
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="plan_id" value={plan.id} />
                      <button className="ghost" title="Adımı sil" aria-label="Adımı sil" style={{ padding: "4px 8px" }}><Icon name="skip" size={14} /></button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </details>
        );
      })}

      <div className="section-title"><h2>Plana ekle</h2></div>
      <details className="disclosure">
        <summary><span className="btn primary"><Icon name="pill" size={16} /> İlaç ekle{medNames.size > 0 ? ` (${medNames.size} ilaç var)` : ""}</span></summary>
        <MedicationForm planId={plan.id} today={todayHasForms} />
      </details>
      <details className="disclosure">
        <summary><span className="btn"><Icon name="plus" size={16} /> Özel adım ekle</span></summary>
        <StepForm planId={plan.id} today={todayHasForms} />
      </details>

      <div className="section-title"><h2>Sahibe gönder</h2></div>
      <div className="card">
        <div className="eyebrow">Özel bağlantı</div>
        <p style={{ margin: "4px 0 10px", wordBreak: "break-all" }}><a href={link}>{link}</a></p>
        <div className="bubble-label">Hazır mesaj</div>
        <div className="bubble">{invite}</div>
        <div className="actions">
          {plan.consent ? (
            <a className="btn wa" href={waLink(plan.phone, invite)} target="_blank" rel="noreferrer"><Icon name="chat" size={16} /> WhatsApp’ta aç</a>
          ) : (
            <span className="muted">Bu sahipten mesaj onayı kaydı yok. Onayı hasta sayfasından işaretleyin; ya da bağlantıyı sahibe elden verin.</span>
          )}
        </div>
      </div>

      <form action={savePlanNotes} className="card stack">
        <input type="hidden" name="plan_id" value={plan.id} />
        <label>
          Sahibe not (plan sayfasında “Hekimin notu” olarak görünür)
          <textarea name="vet_notes" rows={3} maxLength={1000} defaultValue={plan.vet_notes} />
        </label>
        <div><button className="primary">Kaydet</button></div>
      </form>
    </>
  );
}
