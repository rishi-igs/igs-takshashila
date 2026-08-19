-- Stage existing single course picks before LearnerModule is redefined, so
-- they survive the column drop below.
CREATE TABLE "_LearnerModuleCourseStaging" (
    "learnerModuleId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL
);
INSERT INTO "_LearnerModuleCourseStaging" ("learnerModuleId", "courseId")
SELECT "id", "courseId" FROM "LearnerModule" WHERE "courseId" IS NOT NULL;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_LearnerModule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LearnerModule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LearnerModule_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_LearnerModule" ("assignmentId", "createdAt", "id", "userId") SELECT "assignmentId", "createdAt", "id", "userId" FROM "LearnerModule";
DROP TABLE "LearnerModule";
ALTER TABLE "new_LearnerModule" RENAME TO "LearnerModule";
CREATE INDEX "LearnerModule_userId_idx" ON "LearnerModule"("userId");
CREATE INDEX "LearnerModule_assignmentId_idx" ON "LearnerModule"("assignmentId");
CREATE UNIQUE INDEX "LearnerModule_userId_assignmentId_key" ON "LearnerModule"("userId", "assignmentId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateTable (after LearnerModule is back in place, so this FK resolves
-- immediately instead of spanning the redefine above)
CREATE TABLE "LearnerModuleCourse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "learnerModuleId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    CONSTRAINT "LearnerModuleCourse_learnerModuleId_fkey" FOREIGN KEY ("learnerModuleId") REFERENCES "LearnerModule" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LearnerModuleCourse_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "LearnerModuleCourse_learnerModuleId_idx" ON "LearnerModuleCourse"("learnerModuleId");
CREATE INDEX "LearnerModuleCourse_courseId_idx" ON "LearnerModuleCourse"("courseId");
CREATE UNIQUE INDEX "LearnerModuleCourse_learnerModuleId_courseId_key" ON "LearnerModuleCourse"("learnerModuleId", "courseId");

INSERT INTO "LearnerModuleCourse" ("id", "learnerModuleId", "courseId")
SELECT lower(hex(randomblob(16))), "learnerModuleId", "courseId" FROM "_LearnerModuleCourseStaging";

DROP TABLE "_LearnerModuleCourseStaging";
