import { requireLogin } from "@/lib/auth";
import { getSetting } from "@/lib/db";
import { saveSettings } from "../actions";
import { Icon } from "../ui";

export default async function SettingsPage() {
  await requireLogin();
  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Ayarlar</div>
          <h1>Klinik bilgileri</h1>
          <p className="sub">Sahiplere giden mesajlarda ve takip sayfasında görünür.</p>
        </div>
      </div>
      <form action={saveSettings} className="card stack">
        <div className="grid2">
          <label>
            Klinik adı
            <input name="clinic_name" defaultValue={getSetting("clinic_name", "Kliniğimiz")} maxLength={60} required />
          </label>
          <label>
            Klinik telefonu (acil durum için, sahip sayfasında “Kliniği ara” düğmesi)
            <input name="clinic_phone" defaultValue={getSetting("clinic_phone", "")} placeholder="0212 000 00 00" inputMode="tel" />
          </label>
        </div>
        <div><button className="primary">Kaydet</button></div>
      </form>

      <div className="section-title"><h2>Veri ve gizlilik</h2></div>
      <div className="card">
        <p className="muted" style={{ marginTop: 0 }}>
          Veriler bu bilgisayardaki tek bir dosyada tutulur. Düzenli yedek alın. Sahip adı ve telefonu kişisel veridir (KVKK); mesaj onayını kayıt altına alın.
        </p>
        <div className="actions">
          <a className="btn" href="/api/backup"><Icon name="check" size={16} /> Veritabanı yedeğini indir</a>
        </div>
      </div>

      <div className="section-title"><h2>Önemli</h2></div>
      <div className="disclaimer">
        PawTrack bir kayıt ve hatırlatma aracıdır; teşhis koymaz, ilaç veya doz önermez. Uyarılar yalnızca sahibin işaretlediği belirtilere dayanır ve hekimin değerlendirmesinin yerini tutmaz.
      </div>
    </>
  );
}
