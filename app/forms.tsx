"use client";

import { useActionState, useState, useTransition, type FormEvent } from "react";
import { addEntry, addMedication, addPatient, addStep, login, saveTemplate, submitCheckin } from "./actions";
import { LEVELS } from "@/lib/care";

type Act = (prev: string | null, fd: FormData) => Promise<string | null>;
const useForm = (action: Act) => useActionState(action, null as string | null);

// Submits through a transition instead of <form action>, so React does not wipe the fields when the server
// returns a validation error. Fields are cleared only after a successful (OK:) response.
function useAjax(action: Act) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    start(async () => {
      const r = await action(null, data);
      setMsg(r);
      if (r?.startsWith("OK:")) form.reset();
    });
  };
  return [msg, onSubmit, pending] as const;
}

function Msg({ msg }: { msg: string | null }) {
  if (!msg) return null;
  const ok = msg.startsWith("OK:");
  return <div className={ok ? "ok-msg" : "err"}>{ok ? msg.slice(3) : msg}</div>;
}

export function LoginForm() {
  const [err, act, pending] = useForm(login);
  return (
    <form action={act} className="stack card">
      <label>
        Şifre
        <input name="password" type="password" autoFocus required />
      </label>
      <Msg msg={err} />
      <button className="primary block" disabled={pending}>Giriş yap</button>
    </form>
  );
}

export function AddPatientForm({ ownerId, ownerName }: { ownerId?: number; ownerName?: string }) {
  const [err, onSubmit, pending] = useAjax(addPatient);
  return (
    <form onSubmit={onSubmit} className="stack card">
      {ownerId ? (
        <>
          <input type="hidden" name="owner_id" value={ownerId} />
          <div className="muted">Sahip: <b>{ownerName}</b></div>
        </>
      ) : (
        <>
          <div className="grid2">
            <label>
              Sahibin adı soyadı
              <input name="owner_name" required maxLength={80} />
            </label>
            <label>
              Telefon (WhatsApp)
              <input name="phone" required placeholder="0532 123 45 67" inputMode="tel" />
            </label>
          </div>
          <div className="grid2">
            <label className="check">
              <input type="checkbox" name="consent" />
              Sahip hatırlatma mesajı almayı onayladı
            </label>
            <label>
              Onay şekli
              <select name="consent_source" defaultValue="sözlü">
                <option>sözlü</option>
                <option>yazılı / WhatsApp</option>
                <option>form / imza</option>
              </select>
            </label>
          </div>
        </>
      )}
      <div className="grid2">
        <label>
          Hayvanın adı
          <input name="pet_name" required maxLength={60} />
        </label>
        <label>
          Tür
          <select name="species" defaultValue="köpek">
            <option>köpek</option>
            <option>kedi</option>
            <option>kuş</option>
            <option>tavşan</option>
            <option>diğer</option>
          </select>
        </label>
      </div>
      <div className="grid2">
        <label>
          Cins
          <input name="breed" maxLength={60} />
        </label>
        <label>
          Doğum tarihi (yaklaşık olabilir)
          <input name="birth_date" placeholder="12.03.2022" />
        </label>
      </div>
      <label>
        Not (alerji, kronik durum vb.)
        <input name="notes" maxLength={500} />
      </label>
      <Msg msg={err} />
      <div><button className="primary" disabled={pending}>Hastayı ekle</button></div>
    </form>
  );
}

export function EntryForm({ petId, today }: { petId: number; today: string }) {
  const [msg, onSubmit, pending] = useAjax(addEntry);
  return (
    <form onSubmit={onSubmit} className="stack card">
      <input type="hidden" name="pet_id" value={petId} />
      <div className="grid2">
        <label>
          Tür
          <select name="kind" defaultValue="muayene">
            <option>muayene</option>
            <option>ameliyat</option>
            <option>aşı</option>
            <option>tedavi</option>
            <option>kontrol</option>
            <option>diğer</option>
          </select>
        </label>
        <label>
          Tarih
          <input type="date" name="done_on" defaultValue={today} required />
        </label>
      </div>
      <label>
        Başlık
        <input name="title" required maxLength={120} placeholder="Örn. Kısırlaştırma ameliyatı" />
      </label>
      <label>
        Yapılan işlemler
        <textarea name="procedures" rows={2} maxLength={1000} />
      </label>
      <label>
        Kullanılan ilaçlar (hekim girer)
        <textarea name="medications" rows={2} maxLength={1000} placeholder="İlaç adı, doz ve süre hekimin yazdığı şekilde" />
      </label>
      <div className="grid2">
        <label>
          Notlar
          <input name="notes" maxLength={1000} />
        </label>
        <label>
          Hekim
          <input name="vet_name" maxLength={80} />
        </label>
      </div>
      <div className="grid2">
        <label>
          Sahibe hatırlat: tarih (isteğe bağlı)
          <input name="reminder_on" placeholder="24.11.2026" />
        </label>
        <label>
          Hatırlatma başlığı
          <input name="reminder_title" maxLength={100} placeholder="Örn. Kontrol muayenesi" />
        </label>
      </div>
      <Msg msg={msg} />
      <div><button className="primary" disabled={pending}>Kaydı ekle</button></div>
    </form>
  );
}

export function MedicationForm({ planId, today }: { planId: number; today: string }) {
  const [err, onSubmit, pending] = useAjax(addMedication);
  return (
    <form onSubmit={onSubmit} className="stack card">
      <input type="hidden" name="plan_id" value={planId} />
      <div className="grid2">
        <label>
          İlaç adı
          <input name="name" required maxLength={80} />
        </label>
        <label>
          Doz (hekimin yazdığı gibi)
          <input name="dose_text" required maxLength={120} placeholder="Örn. 1 tablet, tok karnına" />
        </label>
      </div>
      <div className="grid2">
        <label>
          Günde kaç kez
          <select name="times_per_day" defaultValue="2">
            <option value="1">1</option>
            <option value="2">2 (sabah, akşam)</option>
            <option value="3">3 (sabah, öğle, akşam)</option>
            <option value="4">4</option>
          </select>
        </label>
        <label>
          Kaç gün
          <input name="days" type="number" min={1} max={60} defaultValue={5} required />
        </label>
      </div>
      <label>
        Başlangıç tarihi
        <input type="date" name="start_date" defaultValue={today} />
      </label>
      <Msg msg={err} />
      <div className="muted">Uygulama doz hesaplamaz veya önermez; yalnızca sizin yazdığınız metni günlere dağıtır.</div>
      <div><button className="primary" disabled={pending}>İlacı plana ekle</button></div>
    </form>
  );
}

export function StepForm({ planId, today }: { planId: number; today: string }) {
  const [err, onSubmit, pending] = useAjax(addStep);
  return (
    <form onSubmit={onSubmit} className="stack card">
      <input type="hidden" name="plan_id" value={planId} />
      <div className="grid2">
        <label>
          Gün
          <input type="date" name="day_date" defaultValue={today} required />
        </label>
        <label>
          Tür
          <select name="kind" defaultValue="task">
            <option value="task">Yapılacak</option>
            <option value="observe">Gözlem</option>
          </select>
        </label>
      </div>
      <label>
        Başlık
        <input name="title" required maxLength={120} placeholder="Örn. Pansumanı değiştir" />
      </label>
      <label>
        Açıklama
        <input name="instructions" maxLength={300} />
      </label>
      <Msg msg={err} />
      <div><button className="primary" disabled={pending}>Adım ekle</button></div>
    </form>
  );
}

export function TemplateForm({ id, name, description, lines }: { id?: number; name?: string; description?: string; lines?: string }) {
  const [msg, onSubmit, pending] = useAjax(saveTemplate);
  return (
    <form onSubmit={onSubmit} className="stack card">
      <input type="hidden" name="id" value={id ?? 0} />
      <div className="grid2">
        <label>
          Şablon adı
          <input name="name" required maxLength={100} defaultValue={name} />
        </label>
        <label>
          Kısa açıklama
          <input name="description" maxLength={200} defaultValue={description} />
        </label>
      </div>
      <label>
        Adımlar (her satır: gün | başlık | açıklama | tür)
        <textarea
          name="lines"
          className="tall"
          required
          defaultValue={lines}
          placeholder={"1-7 | Yara yerini kontrol et | kızarıklık, akıntı | gözlem\n10 | Kontrol randevusu"}
        />
      </label>
      <div className="muted">Gün aralığı yazabilirsiniz (1-7). Tür: yapılacak, gözlem veya ilaç. İlaç dozlarını şablona değil, hastaya özel plana ekleyin.</div>
      <Msg msg={msg} />
      <div><button className="primary" disabled={pending}>Kaydet</button></div>
    </form>
  );
}

export type CheckinDefaults = { appetite: number; water: number; energy: number; vomiting: number; worried: number; temp: number | null; note: string };

function Scale({ name, label, value }: { name: string; label: string; value: number }) {
  return (
    <div className="field-group">
      <span className="lbl">{label}</span>
      <div className="scale">
        {LEVELS.map((l) => (
          <label key={l.v}>
            <input type="radio" name={name} value={l.v} defaultChecked={value === l.v} />
            <span>{l.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export function CheckinForm({ token, dayDate, petName, defaults, days }: { token: string; dayDate: string; petName: string; defaults: CheckinDefaults; days: { value: string; label: string }[] }) {
  const [err, onSubmit, pending] = useAjax(submitCheckin);
  return (
    <form onSubmit={onSubmit} className="stack card">
      <input type="hidden" name="token" value={token} />
      {days.length > 1 ? (
        <label>
          Hangi gün için?
          <select name="day_date" defaultValue={dayDate}>
            {days.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </label>
      ) : (
        <input type="hidden" name="day_date" value={dayDate} />
      )}
      <Scale name="appetite" label={`${petName} yemek yedi mi?`} value={defaults.appetite} />
      <Scale name="water" label="Su içti mi?" value={defaults.water} />
      <Scale name="energy" label="Enerjisi nasıl?" value={defaults.energy} />
      <div className="grid2">
        <label>
          Kaç kez kustu?
          <input name="vomiting" type="number" min={0} max={9} defaultValue={defaults.vomiting} />
        </label>
        <label>
          Ateşi (biliyorsanız)
          <input name="temp" inputMode="decimal" placeholder="38.5" defaultValue={defaults.temp ?? ""} />
        </label>
      </div>
      <label>
        Notunuz
        <textarea name="note" rows={3} maxLength={600} defaultValue={defaults.note} placeholder="Gözleminiz, merak ettikleriniz…" />
      </label>
      <label className="check">
        <input type="checkbox" name="worried" defaultChecked={defaults.worried === 1} />
        Endişeliyim, kliniğin beni aramasını istiyorum
      </label>
      {err && <div className="err">{err}</div>}
      <button className="primary block" disabled={pending}>Kaydet</button>
    </form>
  );
}
