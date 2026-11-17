import { redirect } from "next/navigation";
import { isLoggedIn } from "@/lib/auth";
import { LoginForm } from "../forms";
import { Icon } from "../ui";

export default async function LoginPage() {
  if (await isLoggedIn()) redirect("/");
  return (
    <div className="login-card">
      <div className="login-banner">
        <div className="logo"><Icon name="paw" size={30} /></div>
        <h1>PawTrack</h1>
        <p>Kontrol hatırlatma ve günlük hasta takibi</p>
      </div>
      <div className="login-body">
        <LoginForm />
        <ul className="login-feats">
          <li><Icon name="check" size={16} /> Ameliyat sonrası ve gözlem günlerini gün gün planlayın</li>
          <li><Icon name="check" size={16} /> Sahipler tek bağlantıyla her gün durumu not etsin</li>
          <li><Icon name="check" size={16} /> Dikkat gerektiren notlar panoda sizi beklesin</li>
        </ul>
      </div>
    </div>
  );
}
