import Link from "next/link";
import { requireAdminPage } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkBankHealth } from "@/lib/blueprint";
import { PILLAR_LABELS } from "@/lib/pillars";

export default async function BlueprintsPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; error?: string }>;
}) {
  await requireAdminPage();
  const { created, error } = await searchParams;

  const blueprints = await prisma.assessmentBlueprint.findMany({
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    include: { items: true, designation: { select: { name: true } } },
  });

  const health = await Promise.all(blueprints.map((b) => checkBankHealth(b.id)));

  return (
    <>
      <a href="/admin" className="muted">
        ← Admin
      </a>
      <h1>Assessment blueprints</h1>
      <p className="subtitle">
        The recipe for each test — how many questions, from which pillars, how long, and the pass
        mark. Each blueprint is checked against the live question bank below.
      </p>

      {created && <p className="form-note">Blueprint created.</p>}
      {error && <p className="form-error">{error}</p>}

      <Link href="/admin/blueprints/new" className="button">
        + New blueprint
      </Link>

      {blueprints.length === 0 ? (
        <div className="empty-state" style={{ marginTop: "1.5rem" }}>
          <p>No blueprints yet. Create one to define how tests are built.</p>
        </div>
      ) : (
        blueprints.map((b, i) => {
          const h = health[i];
          return (
            <section key={b.id} style={{ marginTop: "2rem" }}>
              <h2 className="section-heading">
                {b.name} {b.isDefault && <span className="pill">Default</span>}
              </h2>
              <p className="muted">
                {b.designation ? `For ${b.designation.name}` : "Applies to any designation"} —{" "}
                {b.totalQuestions} questions, {b.durationMinutes} minutes, pass at {b.passScore}
              </p>

              {h && !h.healthy && (
                <div className="form-error" role="alert">
                  <strong>Bank health warning</strong>
                  <ul style={{ margin: "0.5rem 0 0", paddingLeft: "1.25rem" }}>
                    {h.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
              {h && h.healthy && (
                <p className="form-note">
                  Bank is healthy — {h.totalAvailable} active questions cover all {h.totalRequired}{" "}
                  required.
                </p>
              )}

              {h && h.rows.length > 0 && (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Pillar</th>
                        <th style={{ textAlign: "right" }}>Required</th>
                        <th style={{ textAlign: "right" }}>Available</th>
                        <th style={{ textAlign: "right" }}>Shortfall</th>
                      </tr>
                    </thead>
                    <tbody>
                      {h.rows.map((r) => (
                        <tr key={r.pillar}>
                          <td>{PILLAR_LABELS[r.pillar]}</td>
                          <td style={{ textAlign: "right" }}>{r.required}</td>
                          <td style={{ textAlign: "right" }}>{r.available}</td>
                          <td style={{ textAlign: "right" }}>
                            {r.shortfall > 0 ? (
                              <strong style={{ color: "var(--error-fg)" }}>{r.shortfall}</strong>
                            ) : (
                              <span className="muted">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          );
        })
      )}
    </>
  );
}
