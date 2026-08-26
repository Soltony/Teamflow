-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "baselineEndDate" TIMESTAMP(3),
ADD COLUMN     "baselineSetAt" TIMESTAMP(3),
ADD COLUMN     "baselineStartDate" TIMESTAMP(3),
ADD COLUMN     "rebaselineCount" INTEGER NOT NULL DEFAULT 0;

-- ---------------------------------------------------------------------------
-- Backfill the baseline for projects that already exist.
--
-- Approving a timeline change overwrote Project.endDate, so the current value
-- is not what these projects committed to. The original date survives in
-- TimelineChangeRequest.oldEndDate: the earliest approved request for a project
-- holds the date it had before anyone moved it. Recovering it here means the
-- schedule metrics are correct for historical projects too, rather than
-- reporting every extended project as never having slipped.
-- ---------------------------------------------------------------------------

-- 1. Projects that have been extended: baseline is the end date they had
--    before the first approved change.
UPDATE "Project" p
SET "baselineEndDate" = earliest."oldEndDate",
    "baselineStartDate" = p."startDate",
    "baselineSetAt" = NOW(),
    "rebaselineCount" = earliest."approvedCount"
FROM (
    SELECT DISTINCT ON ("projectId")
           "projectId",
           "oldEndDate",
           COUNT(*) OVER (PARTITION BY "projectId") AS "approvedCount"
    FROM "TimelineChangeRequest"
    WHERE "status" = 'APPROVED'
    ORDER BY "projectId", "createdAt" ASC
) AS earliest
WHERE p."id" = earliest."projectId";

-- 2. Everything else was never extended, so its current plan is its baseline.
UPDATE "Project"
SET "baselineStartDate" = "startDate",
    "baselineEndDate" = "endDate",
    "baselineSetAt" = NOW()
WHERE "baselineEndDate" IS NULL;
