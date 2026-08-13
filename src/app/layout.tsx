import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { getCurrentUser } from "@/lib/auth";
import { logoutAction } from "@/lib/actions/auth";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "IGS Takshashila Academy",
  description: "Role-based curriculum and course library",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  const isLearner = user?.role === "LEARNER";
  const homeHref = isLearner ? "/my-progress" : "/";

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <header className="site-header">
          <a href={homeHref} className="brand">
            <span className="mark" aria-hidden="true" />
            IGS Takshashila Academy
          </a>
          <nav>
            {isLearner ? (
              <>
                <a href="/my-progress">My Learning</a>
                <a href="/account">Account</a>
                <form action={logoutAction} style={{ display: "inline" }}>
                  <button type="submit" className="secondary">
                    Log out
                  </button>
                </form>
              </>
            ) : user ? (
              <>
                <a href="/">Curriculum</a>
                <a href="/courses">Course Library</a>
                <a href="/my-progress">My Progress</a>
                <a href="/account">Account</a>
                {user.role === "ADMIN" && <a href="/admin">Admin</a>}
                {user.role === "ADMIN" && <a href="/admin/learners">Learners</a>}
                {user.role === "ADMIN" && <a href="/reports">Reports</a>}
                <form action={logoutAction} style={{ display: "inline" }}>
                  <button type="submit" className="secondary">
                    Log out
                  </button>
                </form>
              </>
            ) : (
              <>
                <a href="/">Curriculum</a>
                <a href="/courses">Course Library</a>
                <a href="/login" className="button">
                  Log in
                </a>
              </>
            )}
          </nav>
        </header>
        <main className="site-main">{children}</main>
      </body>
    </html>
  );
}
