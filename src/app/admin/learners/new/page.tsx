import { requireAdminPage } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createLearnerAction } from "@/lib/actions/admin";

export default async function NewLearnerPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdminPage();
  const { error } = await searchParams;

  const designations = await prisma.designation.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="auth-form">
      <a href="/admin/learners" className="muted">
        ← Learners
      </a>
      <h1>Create learner</h1>
      <p className="subtitle">
        A password is generated automatically — you&apos;ll see it once on the next screen to pass
        along to the learner.
      </p>
      {error && <p className="form-error">{error}</p>}
      <form action={createLearnerAction}>
        <label>
          Name
          <input type="text" name="name" required />
        </label>
        <label>
          Email
          <input type="email" name="email" required />
        </label>
        <label>
          Designation (optional — the learner can set this later)
          <select name="designationId" defaultValue="">
            <option value="">Not set</option>
            {designations.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">Create learner</button>
      </form>
    </div>
  );
}
