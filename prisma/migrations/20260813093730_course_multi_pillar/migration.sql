/*
  Warnings:

  - You are about to drop the column `pillar` on the `Course` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "CoursePillar" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseId" TEXT NOT NULL,
    "pillar" TEXT NOT NULL,
    CONSTRAINT "CoursePillar_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Course" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accessType" TEXT NOT NULL,
    "directLink" TEXT,
    "mappedModulesRaw" TEXT NOT NULL,
    "qualityNote" TEXT,
    "validationStatus" TEXT NOT NULL
);
INSERT INTO "new_Course" ("accessType", "directLink", "id", "mappedModulesRaw", "name", "provider", "qualityNote", "validationStatus") SELECT "accessType", "directLink", "id", "mappedModulesRaw", "name", "provider", "qualityNote", "validationStatus" FROM "Course";
DROP TABLE "Course";
ALTER TABLE "new_Course" RENAME TO "Course";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "CoursePillar_courseId_idx" ON "CoursePillar"("courseId");

-- CreateIndex
CREATE INDEX "CoursePillar_pillar_idx" ON "CoursePillar"("pillar");
