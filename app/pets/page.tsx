import { requireLogin } from "@/lib/auth";
import { db, plain } from "@/lib/db";
import { AddPatientForm } from "../forms";
import { Icon } from "../ui";
import { PetList, type PetRow } from "./pet-list";

export default async function PetsPage() {
  await requireLogin();
  const pets = plain<PetRow>(
    db
      .prepare(
        `SELECT p.id, p.name, p.species, p.breed, o.name AS owner_name, o.phone,
                (SELECT COUNT(*) FROM care_plans c WHERE c.pet_id = p.id AND c.status = 'active') AS active_plans,
                (SELECT MAX(done_on) FROM entries e WHERE e.pet_id = p.id) AS last_visit
         FROM pets p JOIN owners o ON o.id = p.owner_id ORDER BY p.name COLLATE NOCASE`,
      )
      .all(),
  );
  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Kayıtlar</div>
          <h1>Hastalar</h1>
          <p className="sub">{pets.length} kayıtlı hasta</p>
        </div>
      </div>
      <details className="disclosure" open={pets.length === 0}>
        <summary>
          <span className="btn primary"><Icon name="plus" size={16} /> Yeni hasta</span>
        </summary>
        <AddPatientForm />
      </details>
      <PetList pets={pets} />
    </>
  );
}
