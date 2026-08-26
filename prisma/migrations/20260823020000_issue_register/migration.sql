-- Promote blockers into a usable issue register.
--
-- Written by hand rather than generated: `title` is NOT NULL and existing rows
-- have no title, so the column has to be added, backfilled from the existing
-- description, and only then constrained. A generated migration would have
-- added it NOT NULL with no default and failed on any database with data in it.

-- ---------------------------------------------------------------- new enums
CREATE TYPE "BlockerSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

CREATE TYPE "BlockerCategory" AS ENUM (
  'RESOURCE', 'TECHNICAL', 'VENDOR', 'FINANCIAL',
  'DEPENDENCY', 'REGULATORY', 'SCOPE', 'OTHER'
);

-- Existing values keep their names and their meaning, so no row changes here.
ALTER TYPE "BlockerStatus" ADD VALUE IF NOT EXISTS 'IN_PROGRESS' BEFORE 'RESOLVED';
ALTER TYPE "BlockerStatus" ADD VALUE IF NOT EXISTS 'ESCALATED' BEFORE 'RESOLVED';
ALTER TYPE "BlockerStatus" ADD VALUE IF NOT EXISTS 'CLOSED';

-- ------------------------------------------------------------- new columns
ALTER TABLE "Blocker"
  ADD COLUMN "title"            TEXT,
  ADD COLUMN "category"         "BlockerCategory" NOT NULL DEFAULT 'OTHER',
  ADD COLUMN "severity"         "BlockerSeverity" NOT NULL DEFAULT 'MEDIUM',
  ADD COLUMN "impact"           TEXT,
  ADD COLUMN "dueDate"          TIMESTAMP(3),
  ADD COLUMN "ownerId"          TEXT,
  ADD COLUMN "raisedById"       TEXT,
  ADD COLUMN "resolvedById"     TEXT,
  ADD COLUMN "escalatedToId"    TEXT,
  ADD COLUMN "escalatedAt"      TIMESTAMP(3),
  ADD COLUMN "escalationReason" TEXT,
  ADD COLUMN "updatedAt"        TIMESTAMP(3);

-- Backfill: the first line of the description, trimmed to something that reads
-- as a label. Existing blockers were free text with no title, so this is the
-- only honest source; the full text stays in `description`.
-- Trim before measuring, then fall back. Checking the length first meant a
-- description of three spaces passed the 1..120 test and became a title of
-- three spaces, rather than reaching the fallback.
UPDATE "Blocker"
SET "title" = COALESCE(
      NULLIF(
        CASE
          WHEN length(trim(split_part("description", E'\n', 1))) > 120
            THEN left(trim(split_part("description", E'\n', 1)), 117) || '...'
          ELSE trim(split_part("description", E'\n', 1))
        END,
        ''),
      'Untitled issue')
WHERE "title" IS NULL;

UPDATE "Blocker" SET "updatedAt" = COALESCE("resolvedAt", "createdAt") WHERE "updatedAt" IS NULL;

ALTER TABLE "Blocker"
  ALTER COLUMN "title" SET NOT NULL,
  ALTER COLUMN "updatedAt" SET NOT NULL;

-- --------------------------------------------------------------- relations
-- SetNull throughout: removing a person must not delete the record of an issue
-- they owned or raised.
ALTER TABLE "Blocker"
  ADD CONSTRAINT "Blocker_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "Blocker_raisedById_fkey"
    FOREIGN KEY ("raisedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "Blocker_resolvedById_fkey"
    FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "Blocker_escalatedToId_fkey"
    FOREIGN KEY ("escalatedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ----------------------------------------------------------------- indexes
CREATE INDEX "Blocker_status_severity_dueDate_idx" ON "Blocker"("status", "severity", "dueDate");
CREATE INDEX "Blocker_ownerId_status_idx" ON "Blocker"("ownerId", "status");
