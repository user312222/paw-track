"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./ui";

const TABS = [
  { href: "/", label: "Bugün", icon: "today" },
  { href: "/pets", label: "Hastalar", icon: "paw" },
  { href: "/templates", label: "Şablonlar", icon: "list" },
  { href: "/settings", label: "Ayarlar", icon: "settings" },
] as const;

export function Tabs({ alerts = 0 }: { alerts?: number }) {
  const path = usePathname();
  return (
    <nav className="tabs" aria-label="Ana menü">
      {TABS.map((t) => {
        const active = t.href === "/" ? path === "/" : path.startsWith(t.href) || (t.href === "/pets" && path.startsWith("/plans"));
        return (
          <Link key={t.href} href={t.href} className="tab" aria-current={active ? "page" : undefined}>
            <Icon name={t.icon} size={18} />
            {t.label}
            {t.href === "/" && alerts > 0 && <span className="tab-badge" aria-label={`${alerts} bekleyen uyarı`}>{alerts}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
