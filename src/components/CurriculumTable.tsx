import { PILLAR_LABELS, PILLAR_ORDER } from "@/lib/pillars";
import type { Pillar } from "@/generated/prisma/enums";
import { setProgressAction } from "@/lib/actions/progress";

export type ProgressStatus = "NOT_STARTED" | "IN_PROGRESS" | "DONE";

export type CurriculumRow = {
  assignmentId: string;
  moduleName: string;
  moduleCode: string;
  requirement: string;
  hours: number;
  standard: string;
  freeLearning: string | null;
  freeLink: string | null;
  premiumLearning: string | null;
  premiumLink: string | null;
  status?: ProgressStatus;
};

function RequirementBadge({ requirement }: { requirement: string }) {
  const key = requirement.toLowerCase();
  const cls = key.includes("mandatory")
    ? "mandatory"
    : key.includes("deployment")
    ? "deployment"
    : key.includes("choose")
    ? "choose"
    : "";
  return <span className={`badge ${cls}`}>{requirement}</span>;
}

const STATUS_OPTIONS: { value: ProgressStatus; label: string }[] = [
  { value: "NOT_STARTED", label: "To do" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "DONE", label: "Done" },
];

function StatusControl({ assignmentId, status }: { assignmentId: string; status: ProgressStatus }) {
  return (
    <div className="status-control">
      {STATUS_OPTIONS.map((o) => (
        <form action={setProgressAction} key={o.value}>
          <input type="hidden" name="assignmentId" value={assignmentId} />
          <input type="hidden" name="status" value={o.value} />
          <button type="submit" className={`status-btn ${status === o.value ? "active" : ""}`}>
            {o.label}
          </button>
        </form>
      ))}
    </div>
  );
}

export default function CurriculumTable({
  rowsByPillar,
  editable,
}: {
  rowsByPillar: Map<Pillar, CurriculumRow[]>;
  editable: boolean;
}) {
  return (
    <>
      {PILLAR_ORDER.filter((p) => rowsByPillar.has(p)).map((pillar) => {
        const rows = rowsByPillar.get(pillar)!;
        const pillarHours = rows.reduce((sum, r) => sum + r.hours, 0);
        return (
          <section key={pillar}>
            <h2>
              {PILLAR_LABELS[pillar]}{" "}
              <span className="muted" style={{ fontWeight: 400, fontSize: "0.85rem" }}>
                ({rows.length} modules · {pillarHours} hrs)
              </span>
            </h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Module</th>
                    <th>Requirement</th>
                    <th>Hours</th>
                    <th>Standard / expectation</th>
                    <th>Learning</th>
                    {editable && <th>Progress</th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.assignmentId}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{r.moduleName}</div>
                        <div className="muted" style={{ fontSize: "0.82rem" }}>
                          {r.moduleCode}
                        </div>
                      </td>
                      <td>
                        <RequirementBadge requirement={r.requirement} />
                      </td>
                      <td>{r.hours}</td>
                      <td className="muted" style={{ fontSize: "0.85rem" }}>
                        {r.standard}
                      </td>
                      <td>
                        <div className="link-list">
                          {r.freeLink ? (
                            <a href={r.freeLink} target="_blank" rel="noreferrer">
                              Free: {r.freeLearning || "Link"}
                            </a>
                          ) : r.freeLearning ? (
                            <span className="muted">Free: {r.freeLearning}</span>
                          ) : null}
                          {r.premiumLink ? (
                            <a href={r.premiumLink} target="_blank" rel="noreferrer">
                              Premium: {r.premiumLearning || "Link"}
                            </a>
                          ) : r.premiumLearning ? (
                            <span className="muted">Premium: {r.premiumLearning}</span>
                          ) : null}
                        </div>
                      </td>
                      {editable && (
                        <td>
                          <StatusControl assignmentId={r.assignmentId} status={r.status ?? "NOT_STARTED"} />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </>
  );
}
