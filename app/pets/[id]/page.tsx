import Link from "next/link";
import { notFound } from "next/navigation";
import { requireLogin } from "@/lib/auth";
import { db, plain, type Entry, type Owner, type Pet, type Plan } from "@/lib/db";
import { ageText, formatDateTR, today } from "@/lib/dates";
import { deleteEntry, deletePet, setConsent, startPlan } from "../../actions";
import { AddPatientForm, EntryForm } from "../../forms";
import { Icon, PetAvatar } from "../../ui";

export default async function PetPage({ params }: PageProps<"/pets/[id]">) {
  await requireLogin();
  const { id } = await params;
  const raw = db.prepare("SELECT * FROM pets WHERE id = ?").get(Number(id));
  if (!raw) notFound();
  const pet = { ...raw } as unknown as Pet;
  const owner = { ...db.prepare("SELECT * FROM owners WHERE id = ?").get(pet.owner_id) } as unknown as Owner;
  const entries = plain<Entry>(db.prepare("SELECT * FROM entries WHERE pet_id = ? ORDER BY done_on DESC, id DESC").all(pet.id));
  const plans = plain<Plan>(db.prepare("SELECT * FROM care_plans WHERE pet_id = ? ORDER BY status, start_date DESC").all(pet.id));
  const templates = plain<{ id: number; name: string; days: number }>(db.prepare("SELECT id, name, days FROM plan_templates ORDER BY name").all());
  const siblings = plain<{ id: number; name: string; species: string }>(db.prepare("SELECT id, name, species FROM pets WHERE owner_id = ? AND id <> ?").all(owner.id, pet.id));
  const t = today();
  const meta = [pet.species, pet.breed, pet.sex, ageText(pet.birth_date)].filter(Boolean).join(" · ");

  return (
    <>
      <div className="pet-head">
        <div className="who" style={{ gap: 16 }}>
          <PetAvatar species={pet.species} large />
          <div>
            <div className="eyebrow">Hasta</div>
            <h1>{pet.name}</h1>
            <div className="chips">
              {meta.split(" · ").filter(Boolean).map((m) => <span className="tag" key={m}>{m}</span>)}
              {plans.some((p) => p.status === "active") && <span className="tag accent">aktif takip</span>}
            </div>
          </div>
        </div>
        <div className="owner-box">
          <div><strong>{owner.name}</strong></div>
          <div className="muted"><Icon name="phone" size={14} /> +{owner.phone}</div>
          <div className="actions" style={{ marginTop: 8, justifyContent: "flex-end" }}>
            <a className="btn" href={`tel:+${owner.phone}`}><Icon name="phone" size={15} /> Ara</a>
            <span className={owner.consent ? "tag ok" : "tag warn"}>{owner.consent ? "mesaj onayı var" : "mesaj onayı yok"}</span>
          </div>
        </div>
      </div>
      {pet.notes && <div className="card flat"><strong>Not:</strong> {pet.notes}</div>}

      <div className="section-title"><h2>Takip planları</h2><span className="count">{plans.length}</span></div>
      {plans.map((p) => (
        <Link href={`/plans/${p.id}`} className="card row" key={p.id} style={{ textDecoration: "none", color: "inherit" }}>
          <div>
            <strong>{p.name}</strong>
            <div className="muted">{formatDateTR(p.start_date)} – {formatDateTR(p.end_date)}</div>
          </div>
          <span className={p.status === "active" ? (p.end_date < t ? "tag warn" : "tag accent") : "tag"}>
            {p.status === "active" ? (p.end_date < t ? "süresi doldu" : "aktif") : "kapandı"}
          </span>
        </Link>
      ))}
      <details className="disclosure">
        <summary><span className="btn primary"><Icon name="plus" size={16} /> Takip planı başlat</span></summary>
        <form action={startPlan} className="stack card">
          <input type="hidden" name="pet_id" value={pet.id} />
          <div className="grid2">
            <label>
              Şablon
              <select name="template_id" defaultValue={templates[0]?.id ?? 0}>
                {templates.map((x) => (
                  <option key={x.id} value={x.id}>{x.name}</option>
                ))}
                <option value="0">Boş plan (kendim ekleyeceğim)</option>
              </select>
            </label>
            <label>
              Başlangıç
              <input type="date" name="start_date" defaultValue={t} required />
            </label>
          </div>
          <div className="grid2">
            <label>
              Boş plan: ad
              <input name="name" maxLength={100} placeholder="Örn. Yara bakımı" />
            </label>
            <label>
              Boş plan: kaç gün
              <input name="days" type="number" min={1} max={90} defaultValue={7} />
            </label>
          </div>
          <label>
            Sahibe not (plan sayfasında görünür)
            <textarea name="vet_notes" rows={2} maxLength={1000} placeholder="Örn. Yaka çıkarılmasın; endişe durumunda kliniği arayın." />
          </label>
          <div><button className="primary">Planı oluştur</button></div>
        </form>
      </details>

      <div className="section-title"><h2>Klinik kayıtları</h2><span className="count">{entries.length}</span></div>
      {entries.length === 0 ? (
        <div className="card empty"><strong>Henüz kayıt yok</strong>Aşağıdan muayene, ameliyat veya tedavi ekleyin.</div>
      ) : (
        <div className="timeline">
          {entries.map((e) => (
            <div className="tl entry" key={e.id}>
              <div className="when">{formatDateTR(e.done_on)} · <span className="tag accent">{e.kind}</span>{e.vet_name && ` · ${e.vet_name}`}</div>
              <strong>{e.title}</strong>
              {e.procedures && <div><span className="muted">İşlemler:</span> <span className="mono-note">{e.procedures}</span></div>}
              {e.medications && <div><span className="tag kind-med"><Icon name="pill" size={12} /> İlaçlar</span> <span className="mono-note">{e.medications}</span></div>}
              {e.notes && <div className="muted mono-note">{e.notes}</div>}
              <form action={deleteEntry} style={{ marginTop: 4 }}>
                <input type="hidden" name="id" value={e.id} />
                <input type="hidden" name="pet_id" value={pet.id} />
                <button className="ghost danger" style={{ padding: "2px 6px", fontSize: "0.8rem" }}>Sil</button>
              </form>
            </div>
          ))}
        </div>
      )}
      <details className="disclosure" style={{ marginTop: 18 }}>
        <summary><span className="btn"><Icon name="plus" size={16} /> Kayıt ekle (işlem, ilaç, ameliyat)</span></summary>
        <EntryForm petId={pet.id} today={t} />
      </details>

      <div className="section-title"><h2>Sahip ve ayarlar</h2></div>
      <div className="card flat stack">
        {owner.consent && owner.consent_at && (
          <div className="muted">Mesaj onayı: {formatDateTR(owner.consent_at.slice(0, 10))} · {owner.consent_note || "şekil belirtilmemiş"}</div>
        )}
        {siblings.length > 0 && (
          <div className="actions">
            <span className="muted">Aynı sahibin diğer hayvanları:</span>
            {siblings.map((s) => (
              <Link key={s.id} className="tag accent" href={`/pets/${s.id}`}>{s.name}</Link>
            ))}
          </div>
        )}
        <div className="actions">
          <form action={setConsent} className="actions">
            <input type="hidden" name="owner_id" value={owner.id} />
            <input type="hidden" name="consent" value={owner.consent ? "0" : "1"} />
            {!owner.consent && (
              <select name="consent_source" defaultValue="sözlü" aria-label="Onay şekli" style={{ width: "auto" }}>
                <option>sözlü</option>
                <option>yazılı / WhatsApp</option>
                <option>form / imza</option>
              </select>
            )}
            <button>{owner.consent ? "Onayı kaldır" : "Sahip onayladı olarak işaretle"}</button>
          </form>
          <form action={deletePet}>
            <input type="hidden" name="pet_id" value={pet.id} />
            <button className="danger">Hastayı sil</button>
          </form>
        </div>
      </div>
      <details className="disclosure" style={{ marginTop: 14 }}>
        <summary><span className="btn"><Icon name="paw" size={16} /> Aynı sahibe başka hayvan ekle</span></summary>
        <AddPatientForm ownerId={owner.id} ownerName={owner.name} />
      </details>
    </>
  );
}
