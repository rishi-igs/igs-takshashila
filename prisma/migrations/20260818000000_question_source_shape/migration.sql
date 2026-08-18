-- Records which generator shape produced a question ("topic", "standard",
-- "pillar"), or NULL for a hand-written one.
ALTER TABLE "Question" ADD COLUMN "sourceShape" TEXT;

-- Makes bulk generation idempotent: a module/shape pair can exist only once,
-- so re-running the generator tops the bank up instead of duplicating it.
-- Hand-written questions keep sourceShape NULL, and SQLite treats NULLs as
-- distinct, so any number of them can share a moduleCode.
CREATE UNIQUE INDEX "Question_moduleCode_sourceShape_key" ON "Question"("moduleCode", "sourceShape");
