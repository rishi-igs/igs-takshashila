import Link from "next/link";
import { requireAdminPage } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PILLAR_LABELS, PILLAR_ORDER } from "@/lib/pillars";
import { activeCountsByPillar } from "@/lib/question-bank";
import { createBlueprintAction } from "@/lib/actions/testops";

export default async function NewBlueprintPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdminPage();
  const { error } = await searchParams;

  const [designations, activeCounts] = await Promise.all([
    prisma.designation.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    activeCountsByPillar(),
  ]);

  return (
    <>
      <Link href="/admin/blueprints" className="muted">
        ← Blueprints
      </Link>
      <h1>New blueprint</h1>
      <p className="subtitle">
        Set the recipe. The per-pillar quotas should add up to the total number of questions —
        the bank-health check will flag it if they don&apos;t.
      </p>

      {error && <p className="form-error">{error}</p>}

      <form action={createBlueprintAction} className="auth-form" style={{ maxWidth: "44rem" }}>
        <label>
          Name
          <input type="text" name="name" required placeholder="e.g. Standard SDET assessment" />
        </label>

        <label>
          Designation
          <select name="designationId" defaultValue="">
            <option value="">Any designation</option>
            {designations.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>

        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          <label style={{ flex: 1, minWidth: "10rem" }}>
            Total questions
            <input type="number" name="totalQuestions" min={1} defaultValue={25} required />
          </label>
          <label style={{ flex: 1, minWidth: "10rem" }}>
            Duration (minutes)
            <input type="number" name="durationMinutes" min={1} defaultValue={20} required />
          </label>
          <label style={{ flex: 1, minWidth: "10rem" }}>
            Pass mark
            <input type="number" name="passScore" min={0} defaultValue={15} required />
          </label>
        </div>

        <fieldset style={{ border: "1px solid var(--border)", borderRadius: "0.5rem", padding: "1rem" }}>
          <legend>Questions per pillar</legend>
          {PILLAR_ORDER.map((p) => (
            <label key={p} style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <span style={{ flex: 1 }}>
                {PILLAR_LABELS[p]}
                <span className="muted" style={{ fontSize: "0.82rem" }}>
                  {" "}
                  — {activeCounts[p] ?? 0} active in bank
                </span>
              </span>
              <input
                type="number"
                name={`quota_${p}`}
                min={0}
                defaultValue={0}
                style={{ width: "6rem" }}
              />
            </label>
          ))}
        </fieldset>

        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <input type="checkbox" name="isDefault" />
          Make this the default blueprint
          <span className="muted" style={{ fontSize: "0.82rem" }}>
            (used when a designation has no blueprint of its own)
          </span>
        </label>

        <button type="submit">Create blueprint</button>
      </form>
    </>
  );
}
