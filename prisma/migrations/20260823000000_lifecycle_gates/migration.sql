-- CreateEnum
CREATE TYPE "ProjectStage" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'CLOSING', 'CLOSED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "businessCase" TEXT,
ADD COLUMN     "charter" TEXT,
ADD COLUMN     "initiationNotes" TEXT,
ADD COLUMN     "stage" "ProjectStage" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "submittedAt" TIMESTAMP(3),
ADD COLUMN     "submittedById" TEXT;

-- CreateTable
CREATE TABLE "ProjectClosure" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "deliverablesAccepted" BOOLEAN NOT NULL DEFAULT false,
    "paymentsSettled" BOOLEAN NOT NULL DEFAULT false,
    "blockersClosed" BOOLEAN NOT NULL DEFAULT false,
    "handoverAcknowledged" BOOLEAN NOT NULL DEFAULT false,
    "handoverRecipient" TEXT,
    "lessonsLearned" TEXT,
    "signedOffAt" TIMESTAMP(3),
    "signedOffById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectClosure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectClosure_projectId_key" ON "ProjectClosure"("projectId");

-- CreateIndex
CREATE INDEX "ProjectClosure_signedOffById_idx" ON "ProjectClosure"("signedOffById");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectClosure" ADD CONSTRAINT "ProjectClosure_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectClosure" ADD CONSTRAINT "ProjectClosure_signedOffById_fkey" FOREIGN KEY ("signedOffById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Backfill the stage for projects that predate the gate.
--
-- The column defaults to DRAFT, which is right for something newly typed in
-- but wrong for work already under way: leaving existing projects at DRAFT
-- would drop the entire live portfolio out of every list and KPI. Projects
-- that exist today were agreed by whatever process preceded this one, so they
-- enter as APPROVED — or as CLOSED where their status already says they are
-- finished.
-- ---------------------------------------------------------------------------

UPDATE "Project" p
   SET "stage" = 'APPROVED',
       "approvedAt" = COALESCE(p."baselineSetAt", p."createdAt")
  FROM "ProjectStatus" s
 WHERE p."statusId" = s."id"
   AND s."category" <> 'CLOSED';

UPDATE "Project" p
   SET "stage" = 'CLOSED',
       "approvedAt" = COALESCE(p."baselineSetAt", p."createdAt")
  FROM "ProjectStatus" s
 WHERE p."statusId" = s."id"
   AND s."category" = 'CLOSED';
