/*
  Warnings:

  - You are about to drop the column `courseId` on the `Assignment` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Assignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "designationId" TEXT NOT NULL,
    "moduleCode" TEXT NOT NULL,
    "requirement" TEXT NOT NULL,
    "hours" INTEGER NOT NULL,
    "freeLearning" TEXT,
    "freeLink" TEXT,
    "premiumLearning" TEXT,
    "premiumLink" TEXT,
    CONSTRAINT "Assignment_designationId_fkey" FOREIGN KEY ("designationId") REFERENCES "Designation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Assignment_moduleCode_fkey" FOREIGN KEY ("moduleCode") REFERENCES "Module" ("code") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Assignment" ("designationId", "freeLearning", "freeLink", "hours", "id", "moduleCode", "premiumLearning", "premiumLink", "requirement") SELECT "designationId", "freeLearning", "freeLink", "hours", "id", "moduleCode", "premiumLearning", "premiumLink", "requirement" FROM "Assignment";
DROP TABLE "Assignment";
ALTER TABLE "new_Assignment" RENAME TO "Assignment";
CREATE INDEX "Assignment_designationId_idx" ON "Assignment"("designationId");
CREATE INDEX "Assignment_moduleCode_idx" ON "Assignment"("moduleCode");
CREATE TABLE "new_LearnerModule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "courseId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LearnerModule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LearnerModule_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LearnerModule_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_LearnerModule" ("assignmentId", "createdAt", "id", "userId") SELECT "assignmentId", "createdAt", "id", "userId" FROM "LearnerModule";
DROP TABLE "LearnerModule";
ALTER TABLE "new_LearnerModule" RENAME TO "LearnerModule";
CREATE INDEX "LearnerModule_userId_idx" ON "LearnerModule"("userId");
CREATE INDEX "LearnerModule_assignmentId_idx" ON "LearnerModule"("assignmentId");
CREATE INDEX "LearnerModule_courseId_idx" ON "LearnerModule"("courseId");
CREATE UNIQUE INDEX "LearnerModule_userId_assignmentId_key" ON "LearnerModule"("userId", "assignmentId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
