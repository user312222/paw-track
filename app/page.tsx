import Link from "next/link";
import { requireLogin } from "@/lib/auth";
import { getSetting } from "@/lib/db";
import { concernReasons, controlReminderMessage, missingCheckinMessage } from "@/lib/care";
import { baseUrl, activePlans, dueReminders, unreviewedAlerts, waLink } from "@/lib/plans";
import { daysBetween, formatDateTR, today } from "@/lib/dates";
import { markReminderSent, reviewCheckin, setPlanStatus, skipReminder } from "./actions";
import { Icon, PetAvatar } from "./ui";

function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="card empty">
      <span className="empty-ico"><Icon name="paw" size={26} /></span>
      <strong>{title}</strong>
      {text}
    </div>
  );
}

function greeting(): string {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Europe/Istanbul" }).format(new Date()));
  return h < 6 ? "İyi geceler" : h < 12 ? "Günaydın" : h < 18 ? "İyi günler" : "İyi akşamlar";
}

export default async function Dashboard() {
  await requireLogin();
  const base = await baseUrl();
  const clinic = getSetting("clinic_name", "Kliniğimiz");
  const t = today();
  const alerts = unreviewedAlerts();
  const plans = activePlans();
  const running = plans.filter((p) => !p.ended && p.start_date <= t);
  const missing = running.filter((p) => p.checked_in_today === 0);
  const ended = plans.filter((p) => p.ended);
  const reminders = dueReminders(7);
  const dateLabel = new Date().toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Istanbul" });
  const summary =
    alerts.length > 0
      ? `${alerts.length} not doktor değerlendirmesini bekliyor.`
      : missing.length > 0
        ? `Bekleyen uyarı yok. ${missing.length} sahip bugün henüz not girmedi.`
        : "Bekleyen uyarı yok, herkes notunu girmiş.";

  return (
    <>
      <div className="dash-hero">
        <div className="eyebrow">{dateLabel}</div>
        <h1>{greeting()}, {clinic}</h1>
        <p>{summary}</p>
        <div className="hero-stats">
          <div className={alerts.length ? "hero-stat hot" : "hero-stat"}><b>{alerts.length}</b><span>Dikkat gereken not</span></div>
          <div className="hero-stat"><b>{missing.length}</b><span>Bugün not girmeyen</span></div>
          <div className="hero-stat"><b>{running.length}</b><span>Aktif takip</span></div>
          <div className="hero-stat"><b>{reminders.length}</b><span>Yaklaşan kontrol</span></div>
        </div>
        <div className="hero-actions">
          <Link className="btn solid" href="/pets"><Icon name="plus" size={16} /> Hasta ekle / bul</Link>
          <Link className="btn" href="/templates"><Icon name="list" size={16} /> Şablonlar</Link>
        </div>
      </div>

      <div className="dash-grid">
        <div>
          <div className="section-title"><h2>Dikkat gerekenler</h2><span className="count">{alerts.length}</span></div>
          {alerts.length === 0 && <Empty title="Bekleyen uyarı yok" text="Sahipler zorlayıcı bir belirti işaretlediğinde burada görünür." />}
          {alerts.map((a) => {
            const reasons = concernReasons(a);
            return (
              <div className="card alert" key={a.id}>
                <div className="reminder-top">
                  <div className="who">
                    <PetAvatar species={a.species} />
                    <div>
                      <Link href={`/plans/${a.plan_id}`} className="who-name">{a.pet_name}</Link>
                      <div className="muted">{a.owner_name} · {a.plan_name} · {formatDateTR(a.day_date)}</div>
                    </div>
                  </div>
                </div>
                <div className="actions" style={{ marginTop: 10 }}>
                  {reasons.map((r) => <span className="tag bad" key={r}>{r}</span>)}
                  {a.temp !== null && <span className="tag">ateş {a.temp}°</span>}
                </div>
                {a.note && <p className="mono-note" style={{ margin: "10px 0 0" }}>“{a.note}”</p>}
                <div className="actions" style={{ marginTop: 14 }}>
                  <a className="btn" href={`tel:+${a.phone}`}><Icon name="phone" size={16} /> Sahibi ara</a>
                  <a className="btn wa" href={`https://wa.me/${a.phone}`} target="_blank" rel="noreferrer"><Icon name="chat" size={16} /> WhatsApp</a>
                  <Link className="btn" href={`/plans/${a.plan_id}`}>Takibi aç</Link>
                  <form action={reviewCheckin}>
                    <input type="hidden" name="id" value={a.id} />
                    <button className="primary"><Icon name="check" size={16} /> Görüldü</button>
                  </form>
                </div>
              </div>
            );
          })}

          <div className="section-title"><h2>Bugün not girmeyenler</h2><span className="count">{missing.length}</span></div>
          {missing.length === 0 ? (
            <Empty title="Herkes notunu girdi" text="Aktif takibi olan sahiplerin hepsi bugün durumu işaretlemiş (ya da aktif takip yok)." />
          ) : (
            <div className="list">
              {missing.map((p) => {
                const msg = missingCheckinMessage({ owner: p.owner_name, pet: p.pet_name, clinic, link: `${base}/p/${p.token}` });
                return (
                  <div className="item" key={p.id}>
                    <div className="who">
                      <PetAvatar species={p.species} />
                      <div>
                        <Link href={`/plans/${p.id}`} className="who-name">{p.pet_name}</Link>
                        <div className="muted">{p.owner_name} · {daysBetween(p.start_date, t) + 1}. gün{p.steps_today > 0 ? ` · ${p.done_today}/${p.steps_today} adım` : ""}</div>
                      </div>
                    </div>
                    {p.consent ? (
                      <a className="btn wa" href={waLink(p.phone, msg)} target="_blank" rel="noreferrer"><Icon name="chat" size={16} /> Hatırlat</a>
                    ) : (
                      <span className="tag warn">onay yok</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {ended.length > 0 && (
            <>
              <div className="section-title"><h2>Süresi dolan takipler</h2><span className="count">{ended.length}</span></div>
              <div className="list">
                {ended.map((p) => (
                  <div className="item" key={p.id}>
                    <div className="who">
                      <PetAvatar species={p.species} />
                      <div>
                        <Link href={`/plans/${p.id}`} className="who-name">{p.pet_name}</Link>
                        <div className="muted">{p.name} · bitiş {formatDateTR(p.end_date)}</div>
                      </div>
                    </div>
                    <form action={setPlanStatus}>
                      <input type="hidden" name="plan_id" value={p.id} />
                      <input type="hidden" name="status" value="closed" />
                      <button>Takibi kapat</button>
                    </form>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div>
          <div className="section-title"><h2>Aktif takipler</h2><span className="count">{running.length}</span></div>
          {running.length === 0 ? (
            <Empty title="Aktif takip yok" text="Bir hasta sayfasından takip planı başlatın (ör. ameliyat sonrası 10 gün)." />
          ) : (
            <div className="list">
              {running.map((p) => {
                const day = daysBetween(p.start_date, t) + 1;
                const total = daysBetween(p.start_date, p.end_date) + 1;
                return (
                  <Link href={`/plans/${p.id}`} className="item" key={p.id}>
                    <div className="who">
                      <PetAvatar species={p.species} />
                      <div>
                        <div className="who-name">{p.pet_name}</div>
                        <div className="muted">{p.name}</div>
                      </div>
                    </div>
                    <div style={{ display: "grid", gap: 6, justifyItems: "end" }}>
                      <span className="tag">{day}/{total}. gün{p.checked_in_today ? " · not var" : ""}</span>
                      <div className="progress" style={{ width: 90 }}><i style={{ width: `${Math.min(100, (day / total) * 100)}%` }} /></div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          <div className="section-title"><h2>Kontrol hatırlatmaları</h2><span className="count">{reminders.length}</span></div>
          {reminders.length === 0 && <Empty title="Önümüzdeki 7 günde kontrol yok" text="Hasta kaydına hatırlatma tarihi eklediğinizde burada listelenir." />}
          {reminders.map((r) => {
            const late = daysBetween(r.due_on, t);
            const msg = controlReminderMessage({ owner: r.owner_name, pet: r.pet_name, clinic, title: r.title, dueOn: formatDateTR(r.due_on) });
            return (
              <div className="card" key={r.id}>
                <div className="reminder-top">
                  <div className="who">
                    <PetAvatar species="" />
                    <div>
                      <Link href={`/pets/${r.pet_id}`} className="who-name">{r.pet_name}</Link>
                      <div className="muted">{r.owner_name} · {r.title}</div>
                    </div>
                  </div>
                  <div className="actions">
                    {!r.consent && <span className="tag warn">onay yok</span>}
                    {late > 0 ? <span className="tag bad">{late} gün gecikti</span> : late === 0 ? <span className="tag ok">bugün</span> : <span className="tag">{formatDateTR(r.due_on)} · {-late} gün sonra</span>}
                  </div>
                </div>
                <div className="bubble-label">Hazır mesaj</div>
                <div className="bubble">{msg}</div>
                <div className="actions">
                  {r.consent ? (
                    <a className="btn wa" href={waLink(r.phone, msg)} target="_blank" rel="noreferrer"><Icon name="chat" size={16} /> WhatsApp’ta aç</a>
                  ) : (
                    <span className="muted">Göndermeden önce sahipten onay alıp hasta sayfasından işaretleyin.</span>
                  )}
                  <form action={markReminderSent}>
                    <input type="hidden" name="id" value={r.id} />
                    <button><Icon name="check" size={16} /> Gönderildi</button>
                  </form>
                  <form action={skipReminder}>
                    <input type="hidden" name="id" value={r.id} />
                    <button className="ghost danger">Atla</button>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
