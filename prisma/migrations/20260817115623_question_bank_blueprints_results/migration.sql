-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pillar" TEXT NOT NULL,
    "moduleCode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Question_moduleCode_fkey" FOREIGN KEY ("moduleCode") REFERENCES "Module" ("code") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuestionVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "questionText" TEXT NOT NULL,
    "optionsJson" TEXT NOT NULL,
    "correctIndex" INTEGER NOT NULL,
    "explanation" TEXT,
    "authorEmail" TEXT NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuestionVersion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AssessmentBlueprint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "designationId" TEXT,
    "totalQuestions" INTEGER NOT NULL DEFAULT 25,
    "durationMinutes" INTEGER NOT NULL DEFAULT 20,
    "passScore" INTEGER NOT NULL DEFAULT 15,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssessmentBlueprint_designationId_fkey" FOREIGN KEY ("designationId") REFERENCES "Designation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BlueprintItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "blueprintId" TEXT NOT NULL,
    "pillar" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    CONSTRAINT "BlueprintItem_blueprintId_fkey" FOREIGN KEY ("blueprintId") REFERENCES "AssessmentBlueprint" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AssessmentResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assessmentId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "totalQuestions" INTEGER NOT NULL,
    "outcome" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "supersedesId" TEXT,
    "recordedByEmail" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssessmentResult_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AssessmentResult_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "AssessmentResult" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AssessmentQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assessmentId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "questionText" TEXT NOT NULL,
    "optionsJson" TEXT NOT NULL,
    "correctIndex" INTEGER NOT NULL,
    "selectedIndex" INTEGER,
    "sourceModuleCode" TEXT NOT NULL,
    "questionVersionId" TEXT,
    CONSTRAINT "AssessmentQuestion_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AssessmentQuestion_questionVersionId_fkey" FOREIGN KEY ("questionVersionId") REFERENCES "QuestionVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_AssessmentQuestion" ("assessmentId", "correctIndex", "id", "optionsJson", "order", "questionText", "selectedIndex", "sourceModuleCode") SELECT "assessmentId", "correctIndex", "id", "optionsJson", "order", "questionText", "selectedIndex", "sourceModuleCode" FROM "AssessmentQuestion";
DROP TABLE "AssessmentQuestion";
ALTER TABLE "new_AssessmentQuestion" RENAME TO "AssessmentQuestion";
CREATE INDEX "AssessmentQuestion_assessmentId_idx" ON "AssessmentQuestion"("assessmentId");
CREATE INDEX "AssessmentQuestion_questionVersionId_idx" ON "AssessmentQuestion"("questionVersionId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Question_pillar_idx" ON "Question"("pillar");

-- CreateIndex
CREATE INDEX "Question_status_idx" ON "Question"("status");

-- CreateIndex
CREATE INDEX "Question_moduleCode_idx" ON "Question"("moduleCode");

-- CreateIndex
CREATE INDEX "QuestionVersion_questionId_idx" ON "QuestionVersion"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionVersion_questionId_version_key" ON "QuestionVersion"("questionId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentBlueprint_name_key" ON "AssessmentBlueprint"("name");

-- CreateIndex
CREATE INDEX "AssessmentBlueprint_designationId_idx" ON "AssessmentBlueprint"("designationId");

-- CreateIndex
CREATE UNIQUE INDEX "BlueprintItem_blueprintId_pillar_key" ON "BlueprintItem"("blueprintId", "pillar");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentResult_supersedesId_key" ON "AssessmentResult"("supersedesId");

-- CreateIndex
CREATE INDEX "AssessmentResult_assessmentId_idx" ON "AssessmentResult"("assessmentId");

-- Exactly one current version per question. Editing a question appends a new
-- version and flips the pointer; this index makes it impossible for two
-- versions of the same question to claim to be current at once.
CREATE UNIQUE INDEX "QuestionVersion_one_current_per_question"
    ON "QuestionVersion"("questionId") WHERE "isCurrent" = true;

-- At most one blueprint may be the default. Both of these need a WHERE
-- clause, which the Prisma schema cannot express, so they are declared here.
CREATE UNIQUE INDEX "AssessmentBlueprint_single_default"
    ON "AssessmentBlueprint"("isDefault") WHERE "isDefault" = true;
