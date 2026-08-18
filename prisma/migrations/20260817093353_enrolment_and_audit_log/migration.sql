-- CreateTable
CREATE TABLE "Enrolment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "designationId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    "note" TEXT,
    CONSTRAINT "Enrolment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Enrolment_designationId_fkey" FOREIGN KEY ("designationId") REFERENCES "Designation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actorId" TEXT,
    "actorEmail" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "summary" TEXT NOT NULL,
    "metaJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "Enrolment_userId_idx" ON "Enrolment"("userId");

-- CreateIndex
CREATE INDEX "Enrolment_designationId_idx" ON "Enrolment"("designationId");

-- CreateIndex
CREATE INDEX "Enrolment_status_idx" ON "Enrolment"("status");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- At most one ACTIVE enrolment per learner. SQLite supports partial unique
-- indexes but the Prisma schema cannot express the WHERE clause, so this is
-- declared here by hand and enforced by the database rather than only in code.
CREATE UNIQUE INDEX "Enrolment_one_active_per_user"
    ON "Enrolment"("userId") WHERE "status" = 'ACTIVE';

-- Backfill: every learner who already has a designation gets an ACTIVE
-- enrolment dated from when their account was created, so tenure history
-- does not start empty for accounts that predate this table.
INSERT INTO "Enrolment" ("id", "userId", "designationId", "status", "startedAt", "note")
SELECT
    lower(hex(randomblob(16))),
    "id",
    "designationId",
    'ACTIVE',
    "createdAt",
    'Backfilled from existing designation'
FROM "User"
WHERE "designationId" IS NOT NULL;
