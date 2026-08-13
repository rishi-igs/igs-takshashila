-- CreateTable
CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "learnerId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ASSIGNED',
    "durationMinutes" INTEGER NOT NULL DEFAULT 20,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" DATETIME,
    "expiresAt" DATETIME,
    "submittedAt" DATETIME,
    "score" INTEGER,
    "totalQuestions" INTEGER NOT NULL DEFAULT 25,
    "autoSubmitted" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Assessment_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AssessmentQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assessmentId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "questionText" TEXT NOT NULL,
    "optionsJson" TEXT NOT NULL,
    "correctIndex" INTEGER NOT NULL,
    "selectedIndex" INTEGER,
    "sourceModuleCode" TEXT NOT NULL,
    CONSTRAINT "AssessmentQuestion_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AssessmentEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assessmentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssessmentEvent_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Assessment_learnerId_idx" ON "Assessment"("learnerId");

-- CreateIndex
CREATE INDEX "AssessmentQuestion_assessmentId_idx" ON "AssessmentQuestion"("assessmentId");

-- CreateIndex
CREATE INDEX "AssessmentEvent_assessmentId_idx" ON "AssessmentEvent"("assessmentId");
