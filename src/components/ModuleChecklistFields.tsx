import { PILLAR_LABELS, PILLAR_ORDER } from "@/lib/pillars";
import type { ModuleChecklistData } from "@/lib/module-checklist";

type CourseList = ReturnType<ModuleChecklistData["coursesByModuleCode"]["get"]>;
type Course = NonNullable<CourseList>[number];

export type { Course };

export function CoursePicker({ assignmentId, courses, defaultCourseIds }: { assignmentId: string; courses: Course[]; defaultCourseIds: string[] }) {
  if (courses.length === 0) {
    return (
      <span className="muted" style={{ fontSize: "0.82rem" }}>
        No courses mapped to this module yet.
      </span>
    );
  }
  const selectedCount = defaultCourseIds.length;
  return (
    <details className="dropdown">
      <summary>{selectedCount > 0 ? `${selectedCount} course${selectedCount === 1 ? "" : "s"} selected` : "Select courses"}</summary>
      <div className="dropdown-panel">
        {courses.map((c) => (
          <label
            key={c.id}
            style={{
              display: "block",
              width: "100%",
              fontSize: "0.9rem",
              fontWeight: 500,
              color: "var(--foreground)",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              name={`courseIds_${assignmentId}`}
              value={c.id}
              defaultChecked={defaultCourseIds.includes(c.id)}
              style={{ width: "auto", minWidth: 0, verticalAlign: "middle", marginRight: "0.55rem" }}
            />
            <span style={{ verticalAlign: "middle" }}>
              {c.name} — {c.provider} ({c.accessType})
            </span>
          </label>
        ))}
      </div>
    </details>
  );
}

// Renders one row per already-selected module — a hidden `assignmentId`
// input (the selection itself isn't editable here, only which courses cover
// it) plus a multi-select course picker scoped to that exact module. Must be
// embedded inside a <form> that posts `courseIds_<assignmentId>` (repeated).
export default function ModuleChecklistFields({
  data,
  courseIdsByAssignmentId,
}: {
  data: ModuleChecklistData;
  courseIdsByAssignmentId: Map<string, string[]>;
}) {
  const { byPillar, coursesByModuleCode } = data;

  return (
    <>
      {PILLAR_ORDER.filter((p) => byPillar.has(p)).map((pillar) => (
        <section key={pillar}>
          <h2>{PILLAR_LABELS[pillar]}</h2>
          <div className="checklist">
            {byPillar.get(pillar)!.map((a) => {
              const moduleCourses: Course[] = coursesByModuleCode.get(a.module.code) ?? [];
              const isMandatory = a.requirement === "Mandatory";
              // Mandatory modules default to their single best-match course
              // checked until the admin saves a different pick — not every
              // matching course at once, which for a module mapped to many
              // courses would dump all of them into the learner's view.
              const defaultCourseIds =
                courseIdsByAssignmentId.get(a.id) ??
                (isMandatory && moduleCourses.length > 0 ? [moduleCourses[0].id] : []);

              return (
                <div key={a.id} className="checklist-item locked">
                  <input type="checkbox" checked readOnly disabled />
                  <input type="hidden" name="assignmentId" value={a.id} />
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", flex: 1, minWidth: 0 }}>
                    <span>
                      {a.module.name}{" "}
                      <span className="muted">
                        ({a.module.code} · {a.hours} hrs){isMandatory ? " · mandatory" : ""}
                      </span>
                    </span>
                    <CoursePicker assignmentId={a.id} courses={moduleCourses} defaultCourseIds={defaultCourseIds} />
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
