"use client";

import { useRouter } from "next/navigation";
import { PILLAR_LABELS, PILLAR_ORDER } from "@/lib/pillars";
import { buildLearnerReloadUrl } from "@/lib/learner-form-reload";
import type { Pillar } from "@/generated/prisma/enums";

// The coarse, always-available pillar checklist — doesn't need a designation
// loaded since pillar names are static. Toggling a box reloads the page
// (carrying the rest of the form's state forward) so "Course access" below
// can filter itself down to just the pillars still checked here.
export default function ModuleSelectDropdown({ checkedPillars }: { checkedPillars: Pillar[] }) {
  const router = useRouter();
  const checkedSet = new Set(checkedPillars);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const form = e.currentTarget.form;
    if (!form) return;
    router.push(buildLearnerReloadUrl(form));
  }

  return (
    <details className="dropdown">
      <summary>Select modules</summary>
      <div className="dropdown-panel">
        <p className="muted" style={{ fontSize: "0.8rem", margin: "0 0 0.6rem" }}>
          A pillar has to stay checked for any of its modules to reach the learner at all —
          uncheck one to exclude it entirely. Within a checked pillar, only mandatory modules and
          ones you pick a course for in Course access actually apply; everything else (recommended,
          choose-one, deployment-specific) is left out unless you pin a course to it.
        </p>
        {PILLAR_ORDER.map((pillar) => (
          <label
            key={pillar}
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
              name="pillar"
              value={pillar}
              defaultChecked={checkedSet.has(pillar)}
              onChange={handleChange}
              style={{ width: "auto", minWidth: 0, verticalAlign: "middle", marginRight: "0.55rem" }}
            />
            <span style={{ verticalAlign: "middle" }}>{PILLAR_LABELS[pillar]}</span>
          </label>
        ))}
      </div>
    </details>
  );
}
