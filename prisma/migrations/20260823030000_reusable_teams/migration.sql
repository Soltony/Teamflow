-- Separate a team from the single project it was bound to.
--
-- Hand-written because the whole point is the backfill. A generated migration
-- would drop "Team"."projectId" and take every existing team-to-project link
-- with it. The order here matters: create the join, copy the links into it,
-- derive the assignments, and only then drop the column.

-- ------------------------------------------------------------------- enum
CREATE TYPE "ProjectRole" AS ENUM (
  'SPONSOR', 'PROJECT_MANAGER', 'TEAM_LEAD', 'MEMBER', 'STAKEHOLDER'
);

-- --------------------------------------------------------------- new tables
CREATE TABLE "ProjectTeam" (
  "id"        TEXT NOT NULL,
  "teamId"    TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectTeam_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectAssignment" (
  "id"            TEXT NOT NULL,
  "userId"        TEXT NOT NULL,
  "projectId"     TEXT NOT NULL,
  "role"          "ProjectRole" NOT NULL DEFAULT 'MEMBER',
  "allocationPct" INTEGER NOT NULL DEFAULT 100,
  "startDate"     TIMESTAMP(3),
  "endDate"       TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectAssignment_pkey" PRIMARY KEY ("id")
);

-- --------------------------------------------------------- team columns
ALTER TABLE "Team"
  ADD COLUMN "description" TEXT,
  ADD COLUMN "isActive"    BOOLEAN NOT NULL DEFAULT true;

-- ------------------------------------------- indexes, before any backfill
-- ON CONFLICT below needs these to exist; building them afterwards would let
-- a duplicate in and only fail at the very end.
CREATE UNIQUE INDEX "ProjectTeam_teamId_projectId_key" ON "ProjectTeam"("teamId", "projectId");
CREATE INDEX "ProjectTeam_projectId_idx" ON "ProjectTeam"("projectId");

CREATE UNIQUE INDEX "ProjectAssignment_userId_projectId_role_key"
  ON "ProjectAssignment"("userId", "projectId", "role");
CREATE INDEX "ProjectAssignment_projectId_idx" ON "ProjectAssignment"("projectId");
CREATE INDEX "ProjectAssignment_userId_startDate_endDate_idx"
  ON "ProjectAssignment"("userId", "startDate", "endDate");

CREATE INDEX "Team_isActive_name_idx" ON "Team"("isActive", "name");

-- ------------------------------------------------------- backfill the links
-- Every existing team keeps working on the project it was created for.
INSERT INTO "ProjectTeam" ("id", "teamId", "projectId", "createdAt")
SELECT
  -- Deterministic id derived from the pair, so re-running cannot duplicate.
  md5('pt:' || "id" || ':' || "projectId"),
  "id",
  "projectId",
  "createdAt"
FROM "Team";

-- ------------------------------------------------- backfill the assignments
-- Project managers. Their role was a column on Project and existed nowhere
-- that could answer "what is this person on?".
INSERT INTO "ProjectAssignment" ("id", "userId", "projectId", "role", "allocationPct", "createdAt", "updatedAt")
SELECT
  md5('pa:pm:' || p."id" || ':' || p."projectManagerId"),
  p."projectManagerId",
  p."id",
  'PROJECT_MANAGER',
  100,
  now(),
  now()
FROM "Project" p
ON CONFLICT DO NOTHING;

-- Team leads.
INSERT INTO "ProjectAssignment" ("id", "userId", "projectId", "role", "allocationPct", "createdAt", "updatedAt")
SELECT DISTINCT ON (t."teamLeadId", t."projectId")
  md5('pa:tl:' || t."projectId" || ':' || t."teamLeadId"),
  t."teamLeadId",
  t."projectId",
  'TEAM_LEAD',
  100,
  now(),
  now()
FROM "Team" t
ON CONFLICT DO NOTHING;

-- Team members. The join table for the members relation is named by Prisma;
-- "A" is Team and "B" is User for _TeamMembers.
INSERT INTO "ProjectAssignment" ("id", "userId", "projectId", "role", "allocationPct", "createdAt", "updatedAt")
SELECT DISTINCT ON (m."B", t."projectId")
  md5('pa:m:' || t."projectId" || ':' || m."B"),
  m."B",
  t."projectId",
  'MEMBER',
  100,
  now(),
  now()
FROM "_TeamMembers" m
JOIN "Team" t ON t."id" = m."A"
-- Somebody who leads the team is recorded as its lead, not twice.
WHERE m."B" <> t."teamLeadId"
ON CONFLICT DO NOTHING;

-- --------------------------------------------------------- foreign keys

ALTER TABLE "ProjectTeam"
  ADD CONSTRAINT "ProjectTeam_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectTeam_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectAssignment"
  ADD CONSTRAINT "ProjectAssignment_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectAssignment_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ------------------------------------------------------------- drop the old
-- Last, so everything above could still read it.
ALTER TABLE "Team" DROP CONSTRAINT IF EXISTS "Team_projectId_fkey";
DROP INDEX IF EXISTS "Team_projectId_idx";
ALTER TABLE "Team" DROP COLUMN "projectId";
