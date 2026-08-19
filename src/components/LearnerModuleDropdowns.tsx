import { PILLAR_LABELS, PILLAR_ORDER } from "@/lib/pillars";
import type { ModuleChecklistData } from "@/lib/module-checklist";
import type { Pillar } from "@/generated/prisma/enums";
import { CoursePicker, type Course } from "@/components/ModuleChecklistFields";

// The finer, designation-scoped picker: which course (if any) covers each
// module. Only shows modules whose pillar is still checked in "Select
// modules" — a course can't be pinned to a module that's about to be
// excluded. courseIdsByAssignmentId carries forward whatever was already
// picked, parsed from the query string a reload (designation or pillar
// change) was triggered with, so toggling one field doesn't wipe the other.
export function CourseAccessDropdown({
  data,
  checkedPillars,
  courseIdsByAssignmentId,
}: {
  data: ModuleChecklistData;
  checkedPillars: Pillar[];
  courseIdsByAssignmentId: Map<string, string[]>;
}) {
  const { byPillar, coursesByModuleCode } = data;
  const checkedSet = new Set(checkedPillars);
  const visiblePillars = PILLAR_ORDER.filter((p) => byPillar.has(p) && checkedSet.has(p));

  if (visiblePillars.length === 0) {
    return (
      <p className="muted" style={{ fontSize: "0.82rem" }}>
        No pillars selected in &quot;Select modules&quot; yet.
      </p>
    );
  }

  return (
    <details className="dropdown">
      <summary>Course access</summary>
      <div className="dropdown-panel">
        <p className="muted" style={{ fontSize: "0.8rem", margin: "0 0 0.6rem" }}>
          Mandatory modules reach the learner either way. Everything else listed here (recommended,
          choose-one, deployment-specific) only reaches the learner if you pin a course to it —
          leaving it unchecked leaves that module out of their curriculum entirely.
        </p>
        {visiblePillars.map((pillar) => (
          <div key={pillar} style={{ marginBottom: "0.75rem" }}>
            <div className="muted" style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", margin: "0 0 0.35rem" }}>
              {PILLAR_LABELS[pillar]}
            </div>
            {byPillar.get(pillar)!.map((a) => {
              const moduleCourses: Course[] = coursesByModuleCode.get(a.module.code) ?? [];
              // Mandatory modules default to their single best-match course
              // pre-checked, so they're never left without one just because
              // nobody touched the picker — but not every matching course at
              // once, which for a module mapped to a dozen courses would
              // dump all of them into the learner's Learning column. Once a
              // course change has actually been posted for this module, that
              // selection takes over instead.
              const defaultCourseIds =
                courseIdsByAssignmentId.get(a.id) ??
                (a.requirement === "Mandatory" && moduleCourses.length > 0 ? [moduleCourses[0].id] : []);
              return (
                <div key={a.id} style={{ marginBottom: "0.6rem" }}>
                  <div style={{ fontSize: "0.85rem", marginBottom: "0.3rem" }}>
                    {a.module.name}
                    {a.requirement === "Mandatory" && <span className="muted"> · mandatory</span>}
                  </div>
                  <CoursePicker assignmentId={a.id} courses={moduleCourses} defaultCourseIds={defaultCourseIds} />
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </details>
  );
}
