import { requireLogin } from "@/lib/auth";
import { db, plain } from "@/lib/db";
import { templateToLines, type TemplateStep } from "@/lib/care";
import { deleteTemplate } from "../actions";
import { TemplateForm } from "../forms";
import { Icon } from "../ui";

export default async function TemplatesPage() {
  await requireLogin();
  const templates = plain<{ id: number; name: string; description: string; days: number }>(db.prepare("SELECT * FROM plan_templates ORDER BY name").all());
  const steps = plain<TemplateStep & { template_id: number }>(db.prepare("SELECT * FROM template_steps ORDER BY template_id, day_no, id").all());
  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Ayarlar</div>
          <h1>Takip şablonları</h1>
          <p className="sub">Gün gün adımları bir kez tanımlayın, her hastaya tek tıkla uygulayın.</p>
        </div>
      </div>
      <div className="disclaimer">
        Hazır şablonlar yalnızca örnektir ve ilaç adı ya da doz içermez. Kliniğinizin protokolüne göre hekim tarafından gözden geçirilip düzenlenmelidir.
      </div>

      <div className="section-title"><h2>Şablonlar</h2><span className="count">{templates.length}</span></div>
      {templates.map((t) => {
        const own = steps.filter((s) => s.template_id === t.id);
        return (
          <details className="card" key={t.id}>
            <summary style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <span><strong>{t.name}</strong> <span className="muted">· {t.days} gün · {own.length} adım</span></span>
              <span className="muted">{t.description}</span>
            </summary>
            <div style={{ marginTop: 14 }}>
              <TemplateForm id={t.id} name={t.name} description={t.description} lines={templateToLines(own)} />
              <form action={deleteTemplate}>
                <input type="hidden" name="id" value={t.id} />
                <button className="danger">Şablonu sil</button>
              </form>
            </div>
          </details>
        );
      })}

      <details className="disclosure" style={{ marginTop: 18 }}>
        <summary><span className="btn primary"><Icon name="plus" size={16} /> Yeni şablon</span></summary>
        <TemplateForm />
      </details>
    </>
  );
}
