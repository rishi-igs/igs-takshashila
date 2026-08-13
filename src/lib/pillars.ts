import { Pillar } from "@/generated/prisma/enums";

export const PILLAR_ORDER: Pillar[] = [
  Pillar.PROCESS_AND_QUALITY,
  Pillar.DOMAIN_AND_BUSINESS,
  Pillar.TOOLS_AND_ENGINEERING,
  Pillar.AI_ENABLEMENT,
  Pillar.COMMUNICATION,
];

export const PILLAR_LABELS: Record<Pillar, string> = {
  [Pillar.PROCESS_AND_QUALITY]: "Process & Quality",
  [Pillar.DOMAIN_AND_BUSINESS]: "Domain & Business",
  [Pillar.TOOLS_AND_ENGINEERING]: "Tools & Engineering",
  [Pillar.AI_ENABLEMENT]: "AI Enablement",
  [Pillar.COMMUNICATION]: "Communication, Leadership & Culture",
};
