import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { getCurrentUser } from "@/lib/auth";
import { logoutAction } from "@/lib/actions/auth";
import ThemeToggle from "@/components/ThemeToggle";

const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

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
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <header className="site-header">
          <a href={homeHref} className="brand">
            <img src="/igs-logo.png" alt="IGS" className="mark" />
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
            <ThemeToggle />
          </nav>
        </header>
        <main className="site-main">{children}</main>
      </body>
    </html>
  );
}
