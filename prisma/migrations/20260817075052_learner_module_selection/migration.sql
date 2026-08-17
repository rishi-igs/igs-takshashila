-- CreateTable
CREATE TABLE "LearnerModule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LearnerModule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LearnerModule_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "LearnerModule_userId_idx" ON "LearnerModule"("userId");

-- CreateIndex
CREATE INDEX "LearnerModule_assignmentId_idx" ON "LearnerModule"("assignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "LearnerModule_userId_assignmentId_key" ON "LearnerModule"("userId", "assignmentId");
