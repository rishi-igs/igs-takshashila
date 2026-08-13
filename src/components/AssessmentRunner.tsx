"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { logAssessmentEventAction, submitAssessmentAction } from "@/lib/actions/assessment";

type Question = {
  id: string;
  order: number;
  questionText: string;
  options: string[];
};

const MAX_VIOLATIONS = 3;

export default function AssessmentRunner({
  assessmentId,
  expiresAt,
  questions,
}: {
  assessmentId: string;
  expiresAt: string;
  questions: Question[];
}) {
  const router = useRouter();
  const expiresAtMs = useMemo(() => new Date(expiresAt).getTime(), [expiresAt]);

  const [answers, setAnswers] = useState<Record<string, number>>({});
  const answersRef = useRef(answers);
  answersRef.current = answers;

  const [remainingSeconds, setRemainingSeconds] = useState(() =>
    Math.max(0, Math.round((expiresAtMs - Date.now()) / 1000))
  );
  const [violations, setViolations] = useState(0);
  const [fullscreenLost, setFullscreenLost] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittedRef = useRef(false);

  const doSubmit = useCallback(
    async (auto: boolean) => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      setSubmitting(true);
      await submitAssessmentAction(assessmentId, answersRef.current, auto);
      router.push("/assessment");
      router.refresh();
    },
    [assessmentId, router]
  );

  const flag = useCallback(
    (type: string) => {
      void logAssessmentEventAction(assessmentId, type);
      setViolations((v) => {
        const next = v + 1;
        if (next >= MAX_VIOLATIONS) void doSubmit(true);
        return next;
      });
    },
    [assessmentId, doSubmit]
  );

  // Countdown, ticking off the server-issued deadline (not a client-only clock).
  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.round((expiresAtMs - Date.now()) / 1000));
      setRemainingSeconds(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        void doSubmit(true);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAtMs, doSubmit]);

  // Anti-cheat listeners.
  useEffect(() => {
    function onVisibilityChange() {
      if (document.hidden) flag("tab_hidden");
    }
    function onBlur() {
      flag("window_blur");
    }
    function onFullscreenChange() {
      if (!document.fullscreenElement) {
        setFullscreenLost(true);
        flag("fullscreen_exit");
      } else {
        setFullscreenLost(false);
      }
    }
    function onContextMenu(e: MouseEvent) {
      e.preventDefault();
    }
    function onCopyCutPaste(e: ClipboardEvent) {
      e.preventDefault();
      flag("clipboard_attempt");
    }
    function onKeyDown(e: KeyboardEvent) {
      const blocked =
        e.key === "F12" ||
        (e.ctrlKey && e.shiftKey && ["I", "J", "C"].includes(e.key.toUpperCase())) ||
        (e.ctrlKey && ["u", "s", "p"].includes(e.key.toLowerCase()));
      if (blocked) {
        e.preventDefault();
        flag("devtools_shortcut");
      }
    }
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onBlur);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("copy", onCopyCutPaste);
    document.addEventListener("cut", onCopyCutPaste);
    document.addEventListener("paste", onCopyCutPaste);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("copy", onCopyCutPaste);
      document.removeEventListener("cut", onCopyCutPaste);
      document.removeEventListener("paste", onCopyCutPaste);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [flag]);

  const minutes = String(Math.floor(remainingSeconds / 60)).padStart(2, "0");
  const seconds = String(remainingSeconds % 60).padStart(2, "0");
  const answeredCount = Object.keys(answers).length;

  function resumeFullscreen() {
    document.documentElement.requestFullscreen?.().catch(() => {});
  }

  return (
    <div className="exam" style={{ userSelect: "none" }}>
      <div className="exam-header">
        <div>
          <strong>{answeredCount}</strong> / {questions.length} answered
        </div>
        <div className={`exam-timer ${remainingSeconds <= 60 ? "low" : ""}`}>
          {minutes}:{seconds}
        </div>
      </div>

      {violations > 0 && (
        <p className="form-error">
          {fullscreenLost ? (
            <>
              You left fullscreen.{" "}
              <button type="button" className="secondary" onClick={resumeFullscreen}>
                Resume fullscreen
              </button>
            </>
          ) : (
            `Warning ${violations}/${MAX_VIOLATIONS}: leaving or switching away from this page is being recorded.`
          )}{" "}
          {violations >= MAX_VIOLATIONS - 1 && "One more and your answers will be submitted automatically."}
        </p>
      )}

      {questions.map((q, i) => (
        <div className="exam-question" key={q.id}>
          <p className="exam-question-text">
            {i + 1}. {q.questionText}
          </p>
          <div className="exam-options">
            {q.options.map((opt, idx) => (
              <label key={idx} className={`exam-option ${answers[q.id] === idx ? "selected" : ""}`}>
                <input
                  type="radio"
                  name={q.id}
                  checked={answers[q.id] === idx}
                  onChange={() => setAnswers((a) => ({ ...a, [q.id]: idx }))}
                />
                {opt}
              </label>
            ))}
          </div>
        </div>
      ))}

      <button onClick={() => doSubmit(false)} disabled={submitting}>
        {submitting ? "Submitting…" : "Submit assessment"}
      </button>
    </div>
  );
}
