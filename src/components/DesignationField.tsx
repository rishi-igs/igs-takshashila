"use client";

import { useRouter } from "next/navigation";
import { buildLearnerReloadUrl } from "@/lib/learner-form-reload";

// Picking a designation navigates straight to this same page with the whole
// form's current state (name, email, designationId, checked pillars, checked
// courses) carried over in the query string, so the server re-renders with
// that designation's module and course dropdowns already populated — no
// separate "load" button needed, and nothing already picked gets reset.
export default function DesignationField({
  designations,
  defaultValue,
}: {
  designations: { id: string; name: string }[];
  defaultValue: string;
}) {
  const router = useRouter();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const form = e.currentTarget.form;
    if (!form) return;
    router.push(buildLearnerReloadUrl(form));
  }

  return (
    <select name="designationId" defaultValue={defaultValue} onChange={handleChange}>
      <option value="">Not set</option>
      {designations.map((d) => (
        <option key={d.id} value={d.id}>
          {d.name}
        </option>
      ))}
    </select>
  );
}
