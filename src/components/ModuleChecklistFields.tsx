import { PILLAR_LABELS, PILLAR_ORDER } from "@/lib/pillars";
import type { ModuleChecklistData } from "@/lib/module-checklist";

// Renders the module checklist section of a form: an interactive checkbox
// per non-mandatory module, and a locked (always-included) row with a course
// picker for each mandatory one. Must be embedded inside a <form> that posts
// `assignmentId` (repeated) and `courseId_<assignmentId>`.
export default function ModuleChecklistFields({
  data,
  selectedIds,
  courseIdByAssignmentId,
}: {
  data: ModuleChecklistData;
  // null = unrestricted (every non-mandatory box defaults to checked)
  selectedIds: Set<string> | null;
  courseIdByAssignmentId: Map<string, string>;
}) {
  const { byPillar, coursesByPillar } = data;
  const isRestricted = selectedIds !== null;

  return (
    <>
      {PILLAR_ORDER.filter((p) => byPillar.has(p)).map((pillar) => (
        <section key={pillar}>
          <h2>{PILLAR_LABELS[pillar]}</h2>
          <div className="checklist">
            {byPillar.get(pillar)!.map((a) => {
              const isMandatory = a.requirement === "Mandatory";
              if (!isMandatory) {
                return (
                  <label key={a.id} className="checklist-item">
                    <input
                      type="checkbox"
                      name="assignmentId"
                      value={a.id}
                      defaultChecked={!isRestricted || selectedIds!.has(a.id)}
                    />
                    <span>
                      {a.module.name}{" "}
                      <span className="muted">
                        ({a.module.code} · {a.hours} hrs)
                      </span>
                    </span>
                  </label>
                );
              }
              const pillarCourses = coursesByPillar.get(pillar) ?? [];
              return (
                <div key={a.id} className="checklist-item locked">
                  <input type="checkbox" checked readOnly disabled />
                  <input type="hidden" name="assignmentId" value={a.id} />
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", flex: 1 }}>
                    <span>
                      {a.module.name}{" "}
                      <span className="muted">
                        ({a.module.code} · {a.hours} hrs) · mandatory, always included
                      </span>
                    </span>
                    {pillarCourses.length > 0 && (
                      <select name={`courseId_${a.id}`} defaultValue={courseIdByAssignmentId.get(a.id) || ""}>
                        <option value="">No course selected</option>
                        {pillarCourses.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} — {c.provider} ({c.accessType})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}
