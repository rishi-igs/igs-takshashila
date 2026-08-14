import Groq from "groq-sdk";
import { prisma } from "@/lib/db";
import { getLearnerCurriculum } from "@/lib/learner-curriculum";
import { PILLAR_LABELS, PILLAR_ORDER } from "@/lib/pillars";
import type { Pillar } from "@/generated/prisma/enums";

const MODEL = "llama-3.3-70b-versatile";

function client() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not set");
  return new Groq({ apiKey });
}

async function learnerContext(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { designation: true } });
  if (!user?.designationId || !user.designation) return null;

  const { byPillar } = await getLearnerCurriculum(user.id, user.designationId);
  const lines: string[] = [`Learner: ${user.name}`, `Designation: ${user.designation.name} (${user.designation.roleStage})`, ""];
  for (const pillar of PILLAR_ORDER) {
    const rows = byPillar.get(pillar);
    if (!rows?.length) continue;
    lines.push(`## ${PILLAR_LABELS[pillar]}`);
    for (const r of rows) {
      lines.push(`- ${r.moduleName} (${r.moduleCode}) — ${r.requirement}, ${r.hours} hrs. Standard: ${r.standard}`);
    }
  }
  return lines.join("\n");
}

async function keywordSearchContext(question: string): Promise<string> {
  const words = Array.from(new Set(question.toLowerCase().match(/[a-z]{4,}/g) ?? []));
  if (words.length === 0) return "";

  const [modules, designations] = await Promise.all([
    prisma.module.findMany({
      where: {
        OR: [...words.map((w) => ({ name: { contains: w } })), ...words.map((w) => ({ capabilityTopics: { contains: w } }))],
      },
      take: 15,
    }),
    prisma.designation.findMany({
      where: { OR: words.map((w) => ({ name: { contains: w } })) },
      take: 10,
    }),
  ]);

  const lines: string[] = [];
  if (designations.length) {
    lines.push("## Matching designations");
    for (const d of designations) {
      lines.push(`- ${d.name} (${d.roleStage}, ${d.jobFamily})`);
    }
  }
  if (modules.length) {
    lines.push("## Matching curriculum modules");
    for (const m of modules) {
      lines.push(`- ${m.name} (${m.code}, ${PILLAR_LABELS[m.pillar as Pillar]}) — ${m.capabilityTopics}`);
    }
  }
  return lines.join("\n");
}

export async function answerCurriculumQuestion({
  question,
  userId,
}: {
  question: string;
  userId?: string;
}): Promise<string> {
  const context = (userId ? await learnerContext(userId) : null) ?? (await keywordSearchContext(question));

  const system = `You are the IGS Takshashila Academy assistant. Answer the learner's question using ONLY the curriculum data provided below — never guess, invent, or use outside knowledge. If the data below doesn't cover the question, say plainly that you don't have that information in the curriculum and suggest they check the Curriculum page or ask an admin. Keep answers short: 2-4 sentences, plain text, no markdown formatting (the answer may be read aloud or sent as a text message).

CURRICULUM DATA:
${context || "(no matching curriculum data found)"}`;

  const response = await client().chat.completions.create({
    model: MODEL,
    max_tokens: 300,
    messages: [
      { role: "system", content: system },
      { role: "user", content: question },
    ],
  });

  return response.choices[0]?.message?.content?.trim() ?? "Sorry, I couldn't come up with an answer just now.";
}
