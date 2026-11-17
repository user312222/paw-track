"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon, PetAvatar } from "../ui";

export type PetRow = { id: number; name: string; species: string; breed: string; owner_name: string; phone: string; active_plans: number; last_visit: string | null };

export function PetList({ pets }: { pets: PetRow[] }) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLocaleLowerCase("tr-TR");
  const shown = needle
    ? pets.filter((p) => [p.name, p.owner_name, p.breed, p.phone].some((v) => v.toLocaleLowerCase("tr-TR").includes(needle)))
    : pets;

  if (pets.length === 0) {
    return (
      <div className="card empty">
        <span className="empty-ico"><Icon name="paw" size={26} /></span>
        <strong>Henüz hasta yok</strong>
        Yukarıdan ilk hastayı ekleyin.
      </div>
    );
  }
  return (
    <>
      <div className="search">
        <Icon name="search" size={17} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Hayvan, sahip, cins veya telefon ara…" aria-label="Hasta ara" />
      </div>
      {shown.length === 0 ? (
        <div className="card empty">“{q}” için sonuç yok.</div>
      ) : (
        <div className="pet-grid">
          {shown.map((p) => (
            <Link href={`/pets/${p.id}`} className={p.active_plans > 0 ? "pet-card has-plan" : "pet-card"} key={p.id}>
              <div className="top">
                <PetAvatar species={p.species} large />
                <div>
                  <div className="name">{p.name}</div>
                  <div className="muted">{p.breed || p.species}</div>
                </div>
              </div>
              <div className="muted">{p.owner_name}</div>
              <div className="foot">
                {p.active_plans > 0 ? <span className="tag accent">{p.active_plans} aktif takip</span> : <span className="tag">takip yok</span>}
                <span className="muted">{p.last_visit ? `Son kayıt ${p.last_visit.split("-").reverse().join(".")}` : "kayıt yok"}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
