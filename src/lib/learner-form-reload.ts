// Serializes every field currently on the create-learner form (name, email,
// designation, checked pillar boxes, checked course boxes) into a query
// string and returns the URL to reload with. Used by both the designation
// select and the pillar checkboxes so that changing either one carries the
// other's current state forward instead of resetting it. `pillarsTouched`
// disambiguates "no reload has happened yet" (pillar checkboxes default to
// all-checked) from "a reload happened and zero pillars ended up checked"
// (which must stay zero, not silently reset to all-checked).
export function buildLearnerReloadUrl(form: HTMLFormElement): string {
  const params = new URLSearchParams();
  for (const el of Array.from(form.elements)) {
    if (el instanceof HTMLInputElement && el.type === "checkbox") {
      if (el.name && el.checked) params.append(el.name, el.value);
    } else if (el instanceof HTMLSelectElement || (el instanceof HTMLInputElement && el.type !== "checkbox")) {
      if (el.name && el.value) params.set(el.name, el.value);
    }
  }
  params.set("pillarsTouched", "1");
  return `/admin/learners/new?${params.toString()}`;
}
