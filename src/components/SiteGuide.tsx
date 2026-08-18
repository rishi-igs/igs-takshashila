"use client";

import { useEffect, useMemo, useState } from "react";

type Role = "ADMIN" | "LEARNER" | null;

type Step = {
  title: string;
  text: string;
  navigateTo?: string;
};

const STORAGE_KEY = "igs-guide-state";

function buildSteps(isLoggedIn: boolean, role: Role): Step[] {
  const steps: Step[] = [
    {
      title: "Welcome to the Academy",
      text: "This is a quick guide to finding your way around. Click Next to keep going, or Skip tour to stop anytime.",
    },
    {
      title: "Curriculum Explorer",
      text: "The home page shows a few featured designations. Each one links to its full role-based curriculum — modules, hours and course links.",
    },
  ];

  if (!isLoggedIn) {
    steps.push(
      {
        title: "Log in",
        text: "Click Next to open the login page.",
        navigateTo: "/login",
      },
      {
        title: "Enter your credentials",
        text: "Use the email and password an administrator gave you, then submit the form.",
      },
      {
        title: "Logging in as an admin",
        text: "There's no separate admin login — it's the exact same form. The difference is your account's role: once you log in as an admin, Admin, Learners and Reports appear in the navigation automatically.",
      }
    );
  }

  if (role === "ADMIN") {
    steps.push(
      {
        title: "Admin panel",
        text: "Click Next to open the Admin panel.",
        navigateTo: "/admin",
      },
      {
        title: "Admin dashboard, at a glance",
        text: "The stats at the top show your totals — users, designations, modules and courses across the whole Academy.",
      },
      {
        title: "Learners & Administrators",
        text: "Use the Learners card to create learner accounts and review individual performance. Use Administrators to create or remove other admin accounts.",
      },
      {
        title: "Build the curriculum",
        text: "Add designation, Add module and Add assignment let you shape the curriculum itself. Manage courses edits links, validation status and notes on the course library.",
      },
      {
        title: "Reports",
        text: "The Reports card shows completion by designation and pillar — useful for spotting who's on track and who's stuck.",
      }
    );
  } else {
    steps.push(
      {
        title: "My Progress",
        text: isLoggedIn
          ? "Click Next to open your My Progress page."
          : "Once logged in as a learner, “My Progress” shows your assigned curriculum and lets you track completion module by module.",
        navigateTo: isLoggedIn ? "/my-progress" : undefined,
      },
      {
        title: "Your progress at a glance",
        text: "The stats at the top show your completion percentage, modules done vs. total, and hours completed — the progress bar tracks the same thing visually.",
      },
      {
        title: "Track each module",
        text: "Below, mark every module as To do, In progress or Done as you work through it. Once everything is Done, an admin can send you an assessment — pass it and you'll get a certificate.",
      }
    );
  }

  steps.push({
    title: "That's the tour",
    text: "You can restart this guide anytime from the “Guide me” button in the navigation.",
  });

  return steps;
}

function readState(): { active: boolean; step: number } {
  if (typeof window === "undefined") return { active: false, step: 0 };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { active: false, step: 0 };
    const parsed = JSON.parse(raw);
    return { active: Boolean(parsed.active), step: Number(parsed.step) || 0 };
  } catch {
    return { active: false, step: 0 };
  }
}

function writeState(state: { active: boolean; step: number }) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export default function SiteGuide({ isLoggedIn, role }: { isLoggedIn: boolean; role: Role }) {
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const state = readState();
    setActive(state.active);
    setStep(state.step);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    writeState({ active, step });
  }, [ready, active, step]);

  const steps = useMemo(() => buildSteps(isLoggedIn, role), [isLoggedIn, role]);
  const clampedStep = Math.min(step, steps.length - 1);
  const current = steps[clampedStep];
  const isLast = clampedStep === steps.length - 1;

  function start() {
    setStep(0);
    setActive(true);
  }

  function next() {
    if (current.navigateTo) {
      // A real navigation unmounts this component before React commits any
      // state-driven effect, so persist the advanced step directly first.
      const nextStep = Math.min(clampedStep + 1, steps.length - 1);
      writeState({ active: true, step: nextStep });
      window.location.href = current.navigateTo;
      return;
    }
    if (isLast) {
      setActive(false);
      setStep(0);
    } else {
      setStep((s) => Math.min(s + 1, steps.length - 1));
    }
  }

  function back() {
    setStep((s) => Math.max(s - 1, 0));
  }

  function skip() {
    setActive(false);
    setStep(0);
  }

  if (!active) {
    return (
      <button type="button" className="guide-nav" onClick={start}>
        Guide me
      </button>
    );
  }

  return (
    <div className="guide-panel" role="dialog" aria-label="Site guide">
      <span className="guide-badge">
        Step {clampedStep + 1} of {steps.length}
      </span>
      <p className="guide-title">{current.title}</p>
      <p className="guide-text">{current.text}</p>
      <div className="guide-actions">
        <button type="button" className="secondary" onClick={skip}>
          Skip tour
        </button>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {clampedStep > 0 && (
            <button type="button" className="secondary" onClick={back}>
              Back
            </button>
          )}
          <button type="button" onClick={next}>
            {isLast ? "Done" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
