-- CreateTable
CREATE TABLE "Designation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "roleStage" TEXT NOT NULL,
    "jobFamily" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Module" (
    "code" TEXT NOT NULL PRIMARY KEY,
    "pillar" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capabilityTopics" TEXT NOT NULL,
    "practicalOutput" TEXT NOT NULL,
    "standard" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Assignment" (
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

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accessType" TEXT NOT NULL,
    "directLink" TEXT,
    "pillar" TEXT NOT NULL,
    "mappedModulesRaw" TEXT NOT NULL,
    "qualityNote" TEXT,
    "validationStatus" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "CourseRoleStage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseId" TEXT NOT NULL,
    "roleStage" TEXT NOT NULL,
    CONSTRAINT "CourseRoleStage_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CourseDesignation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseId" TEXT NOT NULL,
    "designationId" TEXT NOT NULL,
    CONSTRAINT "CourseDesignation_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CourseDesignation_designationId_fkey" FOREIGN KEY ("designationId") REFERENCES "Designation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Designation_name_key" ON "Designation"("name");

-- CreateIndex
CREATE INDEX "Assignment_designationId_idx" ON "Assignment"("designationId");

-- CreateIndex
CREATE INDEX "Assignment_moduleCode_idx" ON "Assignment"("moduleCode");

-- CreateIndex
CREATE INDEX "CourseRoleStage_courseId_idx" ON "CourseRoleStage"("courseId");

-- CreateIndex
CREATE INDEX "CourseRoleStage_roleStage_idx" ON "CourseRoleStage"("roleStage");

-- CreateIndex
CREATE INDEX "CourseDesignation_courseId_idx" ON "CourseDesignation"("courseId");

-- CreateIndex
CREATE INDEX "CourseDesignation_designationId_idx" ON "CourseDesignation"("designationId");
