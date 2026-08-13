"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { startAssessmentAction } from "@/lib/actions/assessment";

export default function BeginAssessmentButton({ assessmentId }: { assessmentId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleBegin() {
    // Fullscreen must be requested synchronously inside a user gesture —
    // do it before the async server call, not after.
    const el = document.documentElement;
    if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => {});
    }
    startTransition(async () => {
      await startAssessmentAction(assessmentId);
      router.refresh();
    });
  }

  return (
    <button onClick={handleBegin} disabled={pending}>
      {pending ? "Starting…" : "Begin assessment"}
    </button>
  );
}
