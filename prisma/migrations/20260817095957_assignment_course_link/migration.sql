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
    "courseId" TEXT,
    CONSTRAINT "Assignment_designationId_fkey" FOREIGN KEY ("designationId") REFERENCES "Designation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Assignment_moduleCode_fkey" FOREIGN KEY ("moduleCode") REFERENCES "Module" ("code") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Assignment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Assignment" ("designationId", "freeLearning", "freeLink", "hours", "id", "moduleCode", "premiumLearning", "premiumLink", "requirement") SELECT "designationId", "freeLearning", "freeLink", "hours", "id", "moduleCode", "premiumLearning", "premiumLink", "requirement" FROM "Assignment";
DROP TABLE "Assignment";
ALTER TABLE "new_Assignment" RENAME TO "Assignment";
CREATE INDEX "Assignment_designationId_idx" ON "Assignment"("designationId");
CREATE INDEX "Assignment_moduleCode_idx" ON "Assignment"("moduleCode");
CREATE INDEX "Assignment_courseId_idx" ON "Assignment"("courseId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
