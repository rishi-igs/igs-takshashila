import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { setDesignationAction } from "@/lib/actions/account";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { error } = await searchParams;

  return (
    <div className="auth-form">
      <h1>Account</h1>
      <p className="subtitle">
        {user.name} · {user.email} · {user.role === "ADMIN" ? "Admin" : "Learner"}
      </p>

      {error && <p className="form-error">{error}</p>}

      <p style={{ marginBottom: "0.4rem" }}>
        Designation: <strong>{user.designation ? user.designation.name : "Not set"}</strong>
      </p>

      {user.designationId ? (
        <p className="muted" style={{ marginBottom: "1rem" }}>
          Your designation is fixed and can&apos;t be changed here — contact your admin if it needs
          to be updated.
        </p>
      ) : (
        <DesignationPicker />
      )}
    </div>
  );
}

async function DesignationPicker() {
  const designations = await prisma.designation.findMany({ orderBy: { name: "asc" } });

  return (
    <>
      <p className="muted" style={{ marginBottom: "1rem" }}>
        No designation set yet — pick one to see your curriculum on My Progress. Once saved, it's
        fixed.
      </p>
      <form action={setDesignationAction}>
        <label>
          Designation
          <select name="designationId" defaultValue="">
            <option value="" disabled>
              Select a designation...
            </option>
            {designations.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.roleStage})
              </option>
            ))}
          </select>
        </label>
        <button type="submit">Save designation</button>
      </form>
    </>
  );
}
