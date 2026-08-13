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

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <header className="site-header">
          <a href="/" className="brand">
            <span className="mark" aria-hidden="true" />
            IGS Takshashila Academy
          </a>
          <nav>
            <a href="/">Curriculum</a>
            <a href="/courses">Course Library</a>
            {user ? (
              <>
                <a href="/my-progress">My Progress</a>
                <a href="/account">Account</a>
                {user.role === "ADMIN" && <a href="/admin">Admin</a>}
                {user.role === "ADMIN" && <a href="/reports">Reports</a>}
                <form action={logoutAction} style={{ display: "inline" }}>
                  <button type="submit" className="secondary">
                    Log out
                  </button>
                </form>
              </>
            ) : (
              <>
                <a href="/login">Log in</a>
                <a href="/signup" className="button">
                  Sign up
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
