import { notFound, redirect } from "next/navigation";
import { requireAdminPage, readFlashCredentials } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PILLAR_LABELS, PILLAR_ORDER } from "@/lib/pillars";
import type { Pillar } from "@/generated/prisma/enums";
import { saveLearnerModulesAction, resetLearnerModulesAction } from "@/lib/actions/admin";

export default async function LearnerModulesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  await requireAdminPage();
  const { id } = await params;
  const { created } = await searchParams;

  const learner = await prisma.user.findUnique({ where: { id }, include: { designation: true } });
  if (!learner || learner.role !== "LEARNER") notFound();
  if (!learner.designationId || !learner.designation) {
    redirect(`/admin/learners/${id}`);
  }

  const [assignments, selections] = await Promise.all([
    prisma.assignment.findMany({
      where: { designationId: learner.designationId },
      include: { module: true },
    }),
    prisma.learnerModule.findMany({ where: { userId: id }, select: { assignmentId: true } }),
  ]);

  const selectedIds = new Set(selections.map((s) => s.assignmentId));
  const isRestricted = selectedIds.size > 0;

  const byPillar = new Map<Pillar, typeof assignments>();
  for (const a of assignments) {
    const list = byPillar.get(a.module.pillar) ?? [];
    list.push(a);
    byPillar.set(a.module.pillar, list);
  }
  for (const list of byPillar.values()) {
    list.sort((a, b) => a.module.name.localeCompare(b.module.name));
  }

  const credentials = created ? await readFlashCredentials() : null;

  return (
    <>
      <a href={`/admin/learners/${id}`} className="muted">
        ← {learner.name}
      </a>
      <h1>Choose modules for {learner.name}</h1>
      <p className="subtitle">
        Check the modules this learner should see. Only checked modules will appear on their
        curriculum — leave everything checked, or use &quot;Show entire curriculum&quot; below, to
        give them the full {learner.designation.name} curriculum instead.
      </p>

      {credentials && credentials.email === learner.email && (
        <div className="form-note">
          <strong>Account created.</strong> Share these credentials with {learner.name} — this
          password is shown once and can&apos;t be retrieved again.
          <br />
          Email: <code>{credentials.email}</code>
          <br />
          Password: <code>{credentials.password}</code>
        </div>
      )}

      {isRestricted && (
        <p className="form-note">
          This learner is currently restricted to {selectedIds.size} of {assignments.length} modules.
        </p>
      )}

      {assignments.length === 0 ? (
        <p className="empty-state">This designation has no modules assigned yet.</p>
      ) : (
        <form action={saveLearnerModulesAction}>
          <input type="hidden" name="learnerId" value={id} />
          {PILLAR_ORDER.filter((p) => byPillar.has(p)).map((pillar) => (
            <section key={pillar}>
              <h2>{PILLAR_LABELS[pillar]}</h2>
              <div className="checklist">
                {byPillar.get(pillar)!.map((a) => (
                  <label key={a.id} className="checklist-item">
                    <input
                      type="checkbox"
                      name="assignmentId"
                      value={a.id}
                      defaultChecked={!isRestricted || selectedIds.has(a.id)}
                    />
                    <span>
                      {a.module.name}{" "}
                      <span className="muted">
                        ({a.module.code} · {a.hours} hrs)
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </section>
          ))}
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
            <button type="submit">Save selection</button>
          </div>
        </form>
      )}

      <form action={resetLearnerModulesAction} style={{ marginTop: "0.75rem" }}>
        <input type="hidden" name="learnerId" value={id} />
        <button type="submit" className="secondary">
          Show entire curriculum (remove restriction)
        </button>
      </form>

      <p style={{ marginTop: "1.25rem" }}>
        <a href={`/admin/learners/${id}`}>Skip for now →</a>
      </p>
    </>
  );
}
