import { loginAction } from "@/lib/actions/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="auth-form">
      <h1>Log in</h1>
      {error && <p className="form-error">{error}</p>}
      <form action={loginAction}>
        <label>
          Email
          <input type="email" name="email" required />
        </label>
        <label>
          Password
          <input type="password" name="password" required />
        </label>
        <button type="submit">Log in</button>
      </form>
      <p className="muted">
        No account yet? <a href="/signup">Sign up</a>
      </p>
    </div>
  );
}
