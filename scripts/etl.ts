// One-off import: reads the 6 source CSVs from the repo root and loads them
// into the SQLite database via Prisma. Safe to re-run — it wipes and reloads.
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { parse } from "csv-parse/sync";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient, Pillar } from "../src/generated/prisma/client";

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" });
const prisma = new PrismaClient({ adapter });
const ROOT = path.resolve(__dirname, "..");

const PILLAR_FILES: { file: string; pillar: Pillar; expectedAssignments: number }[] = [
  { file: "IGS_Role_Based_Curriculum_and_Course_Library(Process and Quality).csv", pillar: Pillar.PROCESS_AND_QUALITY, expectedAssignments: 1193 },
  { file: "IGS_Role_Based_Curriculum_and_Course_Library(Domain and Business).csv", pillar: Pillar.DOMAIN_AND_BUSINESS, expectedAssignments: 2918 },
  { file: "IGS_Role_Based_Curriculum_and_Course_Library(Tools and Engineering).csv", pillar: Pillar.TOOLS_AND_ENGINEERING, expectedAssignments: 2032 },
  { file: "IGS_Role_Based_Curriculum_and_Course_Library(AI Enablement).csv", pillar: Pillar.AI_ENABLEMENT, expectedAssignments: 670 },
  { file: "IGS_Role_Based_Curriculum_and_Course_Library(Communication).csv", pillar: Pillar.COMMUNICATION, expectedAssignments: 1219 },
];
const COURSE_LIBRARY_FILE = "IGS_Role_Based_Curriculum_and_Course_Library(Course Library).csv";

const COURSE_PILLAR_MAP: Record<string, Pillar> = {
  "Process & Quality Practice": Pillar.PROCESS_AND_QUALITY,
  "Domain & Business": Pillar.DOMAIN_AND_BUSINESS,
  "Tools & Engineering": Pillar.TOOLS_AND_ENGINEERING,
  "AI Enablement": Pillar.AI_ENABLEMENT,
  "Communication, Leadership & Culture": Pillar.COMMUNICATION,
};

// Every text field passes through this: the source workbook lost some
// characters in a lossy re-encode. "\n<repl>" was a bullet marker,
// "<repl>" mid-sentence was a dash separator.
function cleanText(value: string | undefined | null): string {
  if (!value) return "";
  return value
    .replace(/\n�\s?/g, "\n• ")
    .replace(/�/g, "–")
    .trim();
}

function cleanOrNull(value: string | undefined | null): string | null {
  const v = cleanText(value);
  return v.length ? v : null;
}

function splitLines(value: string | undefined | null): string[] {
  if (!value) return [];
  return value
    .split("\n")
    .map((s) => cleanText(s))
    .filter((s) => s.length > 0);
}

function parseSheet(fileName: string, headerStartsWith: string): Record<string, string>[] {
  const raw = fs.readFileSync(path.join(ROOT, fileName), "utf8");
  const idx = raw.indexOf(headerStartsWith);
  if (idx < 0) throw new Error(`Could not find header "${headerStartsWith}" in ${fileName}`);
  const csvBody = raw.slice(idx);
  return parse(csvBody, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  }) as Record<string, string>[];
}

function parseHours(value: string): number {
  const n = parseInt(String(value).replace(/,/g, "").trim(), 10);
  return Number.isFinite(n) ? n : 0;
}

async function main() {
  console.log("Clearing existing data...");
  await prisma.courseDesignation.deleteMany();
  await prisma.courseRoleStage.deleteMany();
  await prisma.coursePillar.deleteMany();
  await prisma.course.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.module.deleteMany();
  await prisma.designation.deleteMany();

  const designations = new Map<string, { id: string; name: string; roleStage: string; jobFamily: string }>();
  const modules = new Map<string, { code: string; pillar: Pillar; name: string; capabilityTopics: string; practicalOutput: string; standard: string }>();
  const assignments: {
    id: string;
    designationId: string;
    moduleCode: string;
    requirement: string;
    hours: number;
    freeLearning: string | null;
    freeLink: string | null;
    premiumLearning: string | null;
    premiumLink: string | null;
  }[] = [];

  let moduleCollisions = 0;
  let duplicateAssignmentPairs = 0;
  const seenPairs = new Set<string>();

  for (const { file, pillar, expectedAssignments } of PILLAR_FILES) {
    const rows = parseSheet(file, "Designation,Role stage,Job family");
    console.log(`${file}: parsed ${rows.length} rows (expected ${expectedAssignments})`);
    if (rows.length !== expectedAssignments) {
      console.warn(`  WARNING: row count mismatch for ${file}`);
    }

    for (const row of rows) {
      const designationName = cleanText(row["Designation"]);
      const roleStage = cleanText(row["Role stage"]);
      const jobFamily = cleanText(row["Job family"]);
      const moduleCode = cleanText(row["Module ID"]);
      const moduleName = cleanText(row["Curriculum module"]);

      if (!designationName || !moduleCode) continue;

      if (!designations.has(designationName)) {
        designations.set(designationName, { id: designationName, name: designationName, roleStage, jobFamily });
      }

      const existingModule = modules.get(moduleCode);
      if (existingModule && existingModule.name !== moduleName) {
        moduleCollisions++;
      }
      if (!existingModule) {
        modules.set(moduleCode, {
          code: moduleCode,
          pillar,
          name: moduleName,
          capabilityTopics: cleanText(row["Capability and topics covered"]),
          practicalOutput: cleanText(row["Practical output and assessment"]),
          standard: cleanText(row["Standard or expectation"]),
        });
      }

      const pairKey = `${designationName}::${moduleCode}`;
      if (seenPairs.has(pairKey)) duplicateAssignmentPairs++;
      seenPairs.add(pairKey);

      assignments.push({
        id: crypto.randomUUID(),
        designationId: designationName,
        moduleCode,
        requirement: cleanText(row["Requirement"]),
        hours: parseHours(row["Hours"]),
        freeLearning: cleanOrNull(row["Free or official learning"]),
        freeLink: cleanOrNull(row["Free or official link"]),
        premiumLearning: cleanOrNull(row["Premium learning"]),
        premiumLink: cleanOrNull(row["Premium course link"]),
      });
    }
  }

  console.log(`\nDistinct designations: ${designations.size} (expected 98)`);
  console.log(`Distinct modules: ${modules.size} (expected 396)`);
  console.log(`Total assignments: ${assignments.length} (expected 8032)`);
  console.log(`Module code collisions (same code, different name across pillars): ${moduleCollisions}`);
  console.log(`Duplicate designation+module pairs: ${duplicateAssignmentPairs}`);

  console.log("\nInserting designations, modules, assignments...");
  await prisma.designation.createMany({ data: Array.from(designations.values()) });
  await prisma.module.createMany({ data: Array.from(modules.values()) });
  // chunk assignment inserts — SQLite has a bound-parameter limit per statement
  const CHUNK = 500;
  for (let i = 0; i < assignments.length; i += CHUNK) {
    await prisma.assignment.createMany({ data: assignments.slice(i, i + CHUNK) });
  }

  // --- Course Library ---
  const courseRows = parseSheet(COURSE_LIBRARY_FILE, "Provider,Course or learning resource");
  console.log(`\n${COURSE_LIBRARY_FILE}: parsed ${courseRows.length} rows (expected 210)`);

  const courses: {
    id: string;
    provider: string;
    name: string;
    accessType: string;
    directLink: string | null;
    mappedModulesRaw: string;
    qualityNote: string | null;
    validationStatus: string;
  }[] = [];
  const coursePillars: { id: string; courseId: string; pillar: Pillar }[] = [];
  const courseRoleStages: { id: string; courseId: string; roleStage: string }[] = [];
  const courseDesignations: { id: string; courseId: string; designationId: string }[] = [];
  let unmatchedDesignationRefs = 0;
  let unrecognizedPillars = 0;

  for (const row of courseRows) {
    // "Learning pillar" can list more than one pillar, one per line, for
    // courses that satisfy modules across pillars.
    const pillars = splitLines(row["Learning pillar"])
      .map((p) => COURSE_PILLAR_MAP[p])
      .filter((p): p is Pillar => {
        if (!p) unrecognizedPillars++;
        return Boolean(p);
      });
    if (pillars.length === 0) {
      console.warn(`  WARNING: no recognized pillar for course "${cleanText(row["Course or learning resource"])}" — skipping row`);
      continue;
    }
    const courseId = crypto.randomUUID();
    courses.push({
      id: courseId,
      provider: cleanText(row["Provider"]),
      name: cleanText(row["Course or learning resource"]),
      accessType: cleanText(row["Access type"]),
      directLink: cleanOrNull(row["Direct link"]),
      mappedModulesRaw: cleanText(row["Mapped curriculum modules"]),
      qualityNote: cleanOrNull(row["Quality note"]),
      validationStatus: cleanText(row["Validation status"]),
    });
    for (const pillar of pillars) {
      coursePillars.push({ id: crypto.randomUUID(), courseId, pillar });
    }

    for (const roleStage of splitLines(row["Applicable role stages"])) {
      courseRoleStages.push({ id: crypto.randomUUID(), courseId, roleStage });
    }
    for (const designationName of splitLines(row["Applicable designations"])) {
      if (!designations.has(designationName)) {
        unmatchedDesignationRefs++;
        continue;
      }
      courseDesignations.push({ id: crypto.randomUUID(), courseId, designationId: designationName });
    }
  }

  console.log(`Courses: ${courses.length}`);
  console.log(`Course-pillar links: ${coursePillars.length} (unrecognized pillar values: ${unrecognizedPillars})`);
  console.log(`Course-roleStage links: ${courseRoleStages.length}`);
  console.log(`Course-designation links: ${courseDesignations.length} (unmatched designation refs: ${unmatchedDesignationRefs})`);

  await prisma.course.createMany({ data: courses });
  for (let i = 0; i < coursePillars.length; i += CHUNK) {
    await prisma.coursePillar.createMany({ data: coursePillars.slice(i, i + CHUNK) });
  }
  for (let i = 0; i < courseRoleStages.length; i += CHUNK) {
    await prisma.courseRoleStage.createMany({ data: courseRoleStages.slice(i, i + CHUNK) });
  }
  for (let i = 0; i < courseDesignations.length; i += CHUNK) {
    await prisma.courseDesignation.createMany({ data: courseDesignations.slice(i, i + CHUNK) });
  }

  console.log("\nDone.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
