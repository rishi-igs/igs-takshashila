// Removes throwaway rows created while verifying the auth/admin/reporting flow.
import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" });
const prisma = new PrismaClient({ adapter });

async function main() {
  const testUsers = await prisma.user.findMany({ where: { email: { contains: "test.learner." } } });
  const userIds = testUsers.map((u) => u.id);

  await prisma.progress.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  console.log(`Removed ${userIds.length} test user(s).`);

  const testAssignments = await prisma.assignment.deleteMany({
    where: { moduleCode: { startsWith: "TEST-" } },
  });
  console.log(`Removed ${testAssignments.count} test assignment(s).`);

  const testModules = await prisma.module.deleteMany({ where: { code: { startsWith: "TEST-" } } });
  console.log(`Removed ${testModules.count} test module(s).`);

  const testDesignations = await prisma.designation.deleteMany({
    where: { name: { startsWith: "Test Designation " } },
  });
  console.log(`Removed ${testDesignations.count} test designation(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
