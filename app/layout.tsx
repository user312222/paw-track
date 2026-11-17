import type { Metadata } from "next";
import Link from "next/link";
import { isLoggedIn } from "@/lib/auth";
import { getSetting } from "@/lib/db";
import { unreviewedAlerts } from "@/lib/plans";
import { logout } from "./actions";
import { Tabs } from "./nav";
import { BrandMark, Icon } from "./ui";
import "./globals.css";
import "./extra.css";
import "./extra2.css";

export const metadata: Metadata = {
  title: "PawTrack",
  description: "Veteriner klinikleri için kontrol hatırlatma ve günlük hasta takip asistanı",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const loggedIn = await isLoggedIn();
  return (
    <html lang="tr">
      <body>
        {loggedIn ? (
          <>
            <header className="topbar">
              <div className="topbar-inner">
                <Link href="/" className="brand">
                  <BrandMark />
                  <span className="brand-name">{getSetting("clinic_name", "PawTrack")}</span>
                </Link>
                <Tabs alerts={unreviewedAlerts().length} />
                <form action={logout}>
                  <button type="submit" className="ghost logout" title="Çıkış" aria-label="Çıkış">
                    <Icon name="logout" />
                  </button>
                </form>
              </div>
            </header>
            <main className="page">{children}</main>
          </>
        ) : (
          <main className="public">
            <div className="public-card">{children}</div>
          </main>
        )}
      </body>
    </html>
  );
}
