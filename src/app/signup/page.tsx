import { signupAction } from "@/lib/actions/auth";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="auth-form">
      <h1>Create account</h1>
      <p className="subtitle">
        Sign up to track your progress through the curriculum. You&apos;ll pick your designation
        after creating your account.
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
        <button type="submit">Sign up</button>
      </form>
      <p className="muted">
        Already have an account? <a href="/login">Log in</a>
      </p>
    </div>
  );
}
