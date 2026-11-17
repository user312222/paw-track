import type { CSSProperties } from "react";
import { db, getSetting, plain, type CheckinRow, type Step } from "@/lib/db";
import { getPlanByToken, planSteps } from "@/lib/plans";
import { addDays, daysBetween, formatDateTR, today, weekdayTR } from "@/lib/dates";
import { LEVELS } from "@/lib/care";
import { toggleStep } from "../../actions";
import { CheckinForm } from "../../forms";
import { Icon, PET_EMOJI, PetAvatar } from "../../ui";

export const metadata = { title: "Takip", robots: { index: false, follow: false } };

const level = (v: number) => LEVELS.find((l) => l.v === v)?.label ?? String(v);

function StepList({ token, steps, canTick, day }: { token: string; steps: Step[]; canTick: boolean; day?: string }) {
  void day;
  return (
    <div className="steps">
      {steps.map((s) => (
        <div className={s.done_at ? "step done" : "step"} key={s.id}>
          <form action={toggleStep}>
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="step_id" value={s.id} />
            <button className={s.done_at ? "check-btn on" : "check-btn"} disabled={!canTick} aria-label={s.done_at ? "Yapıldı, geri al" : "Yapıldı olarak işaretle"}>
              {s.done_at ? <Icon name="check" size={16} /> : null}
            </button>
          </form>
          <div>
            <div className="step-title">{s.title}</div>
            {s.instructions && <div className="muted">{s.instructions}</div>}
          </div>
          <div className="step-meta">
            {s.kind === "medication" && <span className="tag kind-med"><Icon name="pill" size={12} /> ilaç</span>}
            {s.kind === "observe" && <span className="tag kind-obs">gözlem</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function OwnerPage({ params, searchParams }: PageProps<"/p/[token]">) {
  const { token } = await params;
  const sp = await searchParams;
  const plan = getPlanByToken(token);
  if (!plan) {
    return (
      <div className="card empty">
        <strong>Bu bağlantı geçerli değil</strong>
        Lütfen kliniğinizle iletişime geçin.
      </div>
    );
  }
  const clinic = getSetting("clinic_name", "Kliniğimiz");
  const phone = getSetting("clinic_phone", "");
  const t = today();
  const steps = planSteps(plan.id);
  const checkins = plain<CheckinRow>(db.prepare("SELECT * FROM checkins WHERE plan_id = ? ORDER BY day_date DESC").all(plan.id));
  const total = daysBetween(plan.start_date, plan.end_date) + 1;
  const dayNo = daysBetween(plan.start_date, t) + 1;
  const active = plan.status === "active";
  const started = plan.start_date <= t;

  const todaySteps = steps.filter((s) => s.day_date === t);
  const past = steps.filter((s) => s.day_date < t);
  const upcoming = steps.filter((s) => s.day_date > t && s.day_date <= addDays(t, 2));
  const pastByDay = new Map<string, Step[]>();
  for (const s of past) pastByDay.set(s.day_date, [...(pastByDay.get(s.day_date) ?? []), s]);

  const checkinDays: { value: string; label: string }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(t, -i);
    if (d < plan.start_date) break;
    checkinDays.push({ value: d, label: i === 0 ? `Bugün (${formatDateTR(d)})` : i === 1 ? `Dün (${formatDateTR(d)})` : `${formatDateTR(d)} ${weekdayTR(d)}` });
  }
  const existing = checkins.find((c) => c.day_date === t);
  const defaults = {
    appetite: existing?.appetite ?? 2,
    water: existing?.water ?? 2,
    energy: existing?.energy ?? 2,
    vomiting: existing?.vomiting ?? 0,
    worried: existing?.worried ?? 0,
    temp: existing?.temp ?? null,
    note: existing?.note ?? "",
  };

  return (
    <>
      <div className="pet-hero">
        <div className="clinic">{clinic}</div>
        <div className="hero-row" style={{ marginTop: 10 }}>
          <div>
            <h1>{plan.pet_name}</h1>
            <div className="plan">{plan.name}</div>
          </div>
          <div className="pet-hero-avatar" aria-hidden="true">{PET_EMOJI[plan.species] ?? "🐾"}</div>
        </div>
        {active && started && (
          <div className="hero-row">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <div className="stat-chip"><b>{Math.min(dayNo, total)}/{total}</b>gün</div>
              <div className="stat-chip"><b>{todaySteps.filter((s) => s.done_at).length}/{todaySteps.length}</b>bugünkü adım</div>
            </div>
            <div className="ring lg" style={{ "--p": todaySteps.length ? Math.round((todaySteps.filter((s) => s.done_at).length / todaySteps.length) * 100) : 0 } as CSSProperties}>
              <span>{todaySteps.length ? `%${Math.round((todaySteps.filter((s) => s.done_at).length / todaySteps.length) * 100)}` : "—"}</span>
            </div>
          </div>
        )}
      </div>

      {sp.ok && (
        <div className="saved-banner">
          <Icon name="check" size={18} /> Notunuz kaydedildi, teşekkürler. İsterseniz gün içinde güncelleyebilirsiniz.
        </div>
      )}

      {!active && (
        <div className="card empty">
          <strong>Bu takip kapatıldı</strong>
          Sorularınız için kliniği arayabilirsiniz.
        </div>
      )}

      {phone && (
        <div className="card flat row">
          <span className="muted">Endişeleniyorsanız ya da durum kötüleşirse beklemeyin, kliniği arayın.</span>
          <a className="btn primary" href={`tel:${phone.replace(/[^\d+]/g, "")}`}><Icon name="phone" size={16} /> Kliniği ara</a>
        </div>
      )}

      {plan.vet_notes && (
        <div className="card">
          <div className="eyebrow">Hekimin notu</div>
          <div className="mono-note">{plan.vet_notes}</div>
        </div>
      )}

      {active && started && (
        <>
          <div className="section-title" style={{ marginTop: 22 }}><h2>Bugün yapılacaklar</h2></div>
          {todaySteps.length === 0 ? (
            <div className="card empty"><strong>Bugün için adım yok</strong>Yine de aşağıdan durumu not edebilirsiniz.</div>
          ) : (
            <StepList token={token} steps={todaySteps} canTick />
          )}

          <div className="section-title"><h2>{plan.pet_name} bugün nasıl?</h2></div>
          <CheckinForm token={token} dayDate={t} petName={plan.pet_name} defaults={defaults} days={checkinDays} />
        </>
      )}

      {active && !started && (
        <div className="card empty"><strong>Takip {formatDateTR(plan.start_date)} tarihinde başlayacak</strong>O gün buradan adımları görebilirsiniz.</div>
      )}

      {upcoming.length > 0 && (
        <>
          <div className="section-title"><h2>Yaklaşan günler</h2></div>
          {[...new Set(upcoming.map((s) => s.day_date))].map((d) => (
            <div key={d}>
              <div className="day"><h3>{formatDateTR(d)}</h3><span className="muted">{weekdayTR(d)}</span></div>
              <StepList token={token} steps={upcoming.filter((s) => s.day_date === d)} canTick={false} />
            </div>
          ))}
        </>
      )}

      {checkins.length > 0 && (
        <>
          <div className="section-title"><h2>Önceki notlarınız</h2></div>
          <div className="list">
            {checkins.slice(0, 7).map((c) => (
              <div className="item" key={c.id} style={{ alignItems: "flex-start" }}>
                <div>
                  <strong>{formatDateTR(c.day_date)}</strong>{" "}
                  <span className="muted">yemek {level(c.appetite)} · su {level(c.water)} · enerji {level(c.energy)}{c.vomiting ? ` · kusma ${c.vomiting}` : ""}{c.temp !== null ? ` · ateş ${c.temp}°` : ""}</span>
                  {c.note && <div className="muted mono-note">{c.note}</div>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {pastByDay.size > 0 && (
        <details className="card" style={{ marginTop: 18 }}>
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>Geçmiş günlerin adımları ({past.filter((s) => s.done_at).length}/{past.length} yapıldı)</summary>
          {[...pastByDay.entries()].reverse().map(([d, list]) => (
            <div key={d}>
              <div className="day"><h3>{formatDateTR(d)}</h3><span className="muted">{weekdayTR(d)}</span></div>
              <StepList token={token} steps={list} canTick={active} />
            </div>
          ))}
        </details>
      )}

      <div className="disclaimer" style={{ marginTop: 22 }}>
        <PetAvatar species={plan.species} /> Bu sayfa hekimin verdiği takip listesini ve sizin notlarınızı gösterir; tıbbi tavsiye vermez.
        Notlarınızı klinik ekibi görür. Acil durumlarda doğrudan kliniğe başvurun.
      </div>
    </>
  );
}
