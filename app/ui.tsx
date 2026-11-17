import type { ReactNode } from "react";

type IconName = "today" | "paw" | "list" | "settings" | "logout" | "plus" | "check" | "skip" | "search" | "chat" | "calendar" | "phone" | "pill" | "alert" | "eye";

const PATHS: Record<IconName, ReactNode> = {
  today: (<><rect x="3" y="4" width="18" height="17" rx="3" /><path d="M8 2v4M16 2v4M3 10h18" /><path d="m9 15 2 2 4-4" /></>),
  paw: (<><circle cx="6.5" cy="10" r="1.9" /><circle cx="10.5" cy="6" r="1.9" /><circle cx="15.5" cy="6" r="1.9" /><circle cx="19" cy="10.5" r="1.9" /><path d="M12.5 11.5c-2.6 0-5 3.2-5 5.3 0 1.7 1.4 2.4 2.8 2.2 1-.1 1.4-.4 2.2-.4s1.2.3 2.2.4c1.4.2 2.8-.5 2.8-2.2 0-2.1-2.4-5.3-5-5.3Z" /></>),
  list: (<><path d="M9 6h11M9 12h11M9 18h11" /><path d="m3.5 6 1 1 2-2M3.5 12l1 1 2-2M3.5 18l1 1 2-2" /></>),
  settings: (<><circle cx="12" cy="12" r="3" /><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8" /></>),
  logout: (<><path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" /><path d="m16 8 4 4-4 4M20 12H9" /></>),
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  skip: <path d="M6 6l12 12M18 6 6 18" />,
  search: (<><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4-4" /></>),
  chat: <path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 4V6a1 1 0 0 1 1-1Z" />,
  calendar: (<><rect x="3" y="4" width="18" height="17" rx="3" /><path d="M8 2v4M16 2v4M3 10h18" /></>),
  phone: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />,
  pill: (<><rect x="2.5" y="8.5" width="19" height="7" rx="3.5" transform="rotate(-35 12 12)" /><path d="m9.2 9.6 5.6 4.8" /></>),
  alert: (<><path d="M12 3 2.5 20h19L12 3Z" /><path d="M12 10v4.5M12 17.2v.1" /></>),
  eye: (<><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>),
};

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}

export function BrandMark({ size }: { size?: number }) {
  return (
    <span className="brand-mark" aria-hidden="true">
      <Icon name="paw" size={size ?? 18} />
    </span>
  );
}

export const PET_EMOJI: Record<string, string> = { köpek: "🐕", kedi: "🐈", kuş: "🐦", tavşan: "🐇" };

export function PetAvatar({ species, large }: { species: string; large?: boolean }) {
  return (
    <span className={large ? "pet-avatar lg" : "pet-avatar"} aria-hidden="true">
      {PET_EMOJI[species] ?? "🐾"}
    </span>
  );
}
