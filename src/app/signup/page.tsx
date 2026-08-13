import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { signupAction } from "@/lib/actions/auth";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // Signup only exists to bootstrap the first admin account. Once one
  // exists, all further accounts are created by an admin.
  const userCount = await prisma.user.count();
  if (userCount > 0) redirect("/login");

  const { error } = await searchParams;

  return (
    <div className="auth-form">
      <h1>Create admin account</h1>
      <p className="subtitle">
        No accounts exist yet — this creates the first admin account, which can then create
        learner accounts.
      </p>
      {error && <p className="form-error">{error}</p>}
      <form action={signupAction}>
        <label>
          Name
          <input type="text" name="name" required />
        </label>
        <label>
          Email
          <input type="email" name="email" required />
        </label>
        <label>
          Password
          <input type="password" name="password" required minLength={8} />
        </label>
        <button type="submit">Create admin account</button>
      </form>
      <p className="muted">
        Already have an account? <a href="/login">Log in</a>
      </p>
    </div>
  );
}
