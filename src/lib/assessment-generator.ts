import { prisma } from "@/lib/db";
import { PILLAR_LABELS, PILLAR_ORDER } from "@/lib/pillars";

export type GeneratedQuestion = {
  order: number;
  questionText: string;
  options: string[];
  correctIndex: number;
  sourceModuleCode: string;
};

function truncate(text: string, max = 110): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? clean.slice(0, max - 1).trimEnd() + "…" : clean;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickN<T>(arr: T[], n: number): T[] {
  return shuffle(arr).slice(0, n);
}

type Shape = "topic" | "hours" | "standard" | "pillar";

// Builds a random set of MCQs entirely from the modules already assigned to
// this designation — no external content, no AI call, so it's free and
// deterministic to run. Calling it again produces a different set: which
// (module, question-shape) pairs get picked, which distractors, and the
// on-screen option order are all reshuffled each time.
export async function generateAssessmentQuestions(
  designationId: string,
  count = 25
): Promise<GeneratedQuestion[]> {
  const assignments = await prisma.assignment.findMany({
    where: { designationId },
    include: { module: true },
  });
  if (assignments.length === 0) return [];

  const allModuleNames = Array.from(new Set(assignments.map((a) => a.module.name)));
  const allHours = Array.from(new Set(assignments.map((a) => a.hours)));

  const candidates: { assignment: (typeof assignments)[number]; shape: Shape }[] = [];
  for (const a of assignments) {
    if (a.module.capabilityTopics?.trim()) candidates.push({ assignment: a, shape: "topic" });
    candidates.push({ assignment: a, shape: "hours" });
    if (a.module.standard?.trim()) candidates.push({ assignment: a, shape: "standard" });
    candidates.push({ assignment: a, shape: "pillar" });
  }

  const shuffledCandidates = shuffle(candidates);
  const questions: GeneratedQuestion[] = [];

  for (const { assignment: a, shape } of shuffledCandidates) {
    if (questions.length >= count) break;

    let questionText = "";
    let correctAnswer = "";
    let distractorPool: string[] = [];

    if (shape === "topic") {
      questionText = `Which module covers: "${truncate(a.module.capabilityTopics)}"?`;
      correctAnswer = a.module.name;
      distractorPool = assignments
        .filter((x) => x.module.pillar === a.module.pillar && x.module.code !== a.module.code)
        .map((x) => x.module.name);
      if (distractorPool.length < 3) {
        distractorPool = distractorPool.concat(allModuleNames.filter((n) => n !== correctAnswer));
      }
    } else if (shape === "hours") {
      questionText = `How many hours are assigned to "${a.module.name}" in your curriculum?`;
      correctAnswer = String(a.hours);
      distractorPool = allHours.filter((h) => h !== a.hours).map(String);
    } else if (shape === "standard") {
      questionText = `What is the required standard or expectation for "${a.module.name}"?`;
      correctAnswer = truncate(a.module.standard);
      distractorPool = assignments
        .filter((x) => x.module.code !== a.module.code && x.module.standard?.trim())
        .map((x) => truncate(x.module.standard));
    } else {
      questionText = `Which learning pillar does "${a.module.name}" belong to?`;
      correctAnswer = PILLAR_LABELS[a.module.pillar];
      distractorPool = PILLAR_ORDER.filter((p) => p !== a.module.pillar).map((p) => PILLAR_LABELS[p]);
    }

    const uniqueDistractors = Array.from(new Set(distractorPool.filter((d) => d && d !== correctAnswer)));
    const distractors = pickN(uniqueDistractors, 3);
    if (distractors.length < 3) continue; // not enough plausible wrong answers — skip this one

    // Avoid asking about the same module twice in one assessment.
    if (questions.some((q) => q.sourceModuleCode === a.module.code && q.questionText.includes(a.module.name))) {
      continue;
    }

    const options = shuffle([correctAnswer, ...distractors]);
    questions.push({
      order: questions.length + 1,
      questionText,
      options,
      correctIndex: options.indexOf(correctAnswer),
      sourceModuleCode: a.module.code,
    });
  }

  return questions;
}
