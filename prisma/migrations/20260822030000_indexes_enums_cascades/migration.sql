-- Indexes, enums, referential actions, and the ProjectStatus category.
--
-- The enum conversions are written by hand. `prisma migrate diff` generates
-- DROP COLUMN + ADD COLUMN for them, which would silently discard every
-- existing task status, blocker status, payment status and update type. The
-- ALTER ... USING form below converts in place and preserves the data; a value
-- that does not map to a label aborts the migration rather than being lost.

-- CreateEnum
CREATE TYPE "StatusCategory" AS ENUM ('ACTIVE', 'ON_HOLD', 'HANDOVER', 'CLOSED');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'PENDING_REVIEW', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaskUpdateType" AS ENUM ('COMMENT', 'STATUS_CHANGE');

-- CreateEnum
CREATE TYPE "BlockerStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- DropForeignKey
ALTER TABLE "Blocker" DROP CONSTRAINT "Blocker_projectId_fkey";

-- DropForeignKey
ALTER TABLE "Milestone" DROP CONSTRAINT "Milestone_projectId_fkey";

-- DropForeignKey
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_recipientId_fkey";

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_projectId_fkey";

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_milestoneId_fkey";

-- DropForeignKey
ALTER TABLE "TaskUpdate" DROP CONSTRAINT "TaskUpdate_taskId_fkey";

-- DropForeignKey
ALTER TABLE "Team" DROP CONSTRAINT "Team_projectId_fkey";

-- DropForeignKey
ALTER TABLE "TimelineChangeRequest" DROP CONSTRAINT "TimelineChangeRequest_projectId_fkey";

-- AlterTable
ALTER TABLE "ProjectStatus" ADD COLUMN     "category" "StatusCategory" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "TimelineChangeRequest" ADD COLUMN     "reviewedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Blocker_projectId_status_idx" ON "Blocker"("projectId", "status");

-- CreateIndex
CREATE INDEX "Milestone_projectId_idx" ON "Milestone"("projectId");

-- CreateIndex
CREATE INDEX "Milestone_dueDate_idx" ON "Milestone"("dueDate");

-- CreateIndex
CREATE INDEX "Notification_recipientId_read_createdAt_idx" ON "Notification"("recipientId", "read", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_recipientId_createdAt_idx" ON "Notification"("recipientId", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_projectId_status_idx" ON "Payment"("projectId", "status");

-- CreateIndex
CREATE INDEX "Payment_status_paymentDate_idx" ON "Payment"("status", "paymentDate");

-- CreateIndex
CREATE INDEX "Project_statusId_idx" ON "Project"("statusId");

-- CreateIndex
CREATE INDEX "Project_pmoDivisionId_idx" ON "Project"("pmoDivisionId");

-- CreateIndex
CREATE INDEX "Project_projectManagerId_idx" ON "Project"("projectManagerId");

-- CreateIndex
CREATE INDEX "Project_workingYear_idx" ON "Project"("workingYear");

-- CreateIndex
CREATE INDEX "Project_workingYear_statusId_idx" ON "Project"("workingYear", "statusId");

-- CreateIndex
CREATE INDEX "ProjectStatus_category_idx" ON "ProjectStatus"("category");

-- CreateIndex
CREATE INDEX "Task_milestoneId_idx" ON "Task"("milestoneId");

-- CreateIndex
CREATE INDEX "Task_status_idx" ON "Task"("status");

-- CreateIndex
CREATE INDEX "Task_endDate_idx" ON "Task"("endDate");

-- CreateIndex
CREATE INDEX "Task_status_endDate_idx" ON "Task"("status", "endDate");

-- CreateIndex
CREATE INDEX "Task_completedAt_idx" ON "Task"("completedAt");

-- CreateIndex
CREATE INDEX "Team_projectId_idx" ON "Team"("projectId");

-- CreateIndex
CREATE INDEX "Team_teamLeadId_idx" ON "Team"("teamLeadId");

-- CreateIndex
CREATE INDEX "TimelineChangeRequest_projectId_status_idx" ON "TimelineChangeRequest"("projectId", "status");

-- CreateIndex
CREATE INDEX "TimelineChangeRequest_status_createdAt_idx" ON "TimelineChangeRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "TimelineChangeRequest_requestedById_idx" ON "TimelineChangeRequest"("requestedById");

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskUpdate" ADD CONSTRAINT "TaskUpdate_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Blocker" ADD CONSTRAINT "Blocker_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimelineChangeRequest" ADD CONSTRAINT "TimelineChangeRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Convert the free-text status columns to enums, in place.
--
-- Existing values are normalised first so historical rows written with a
-- different case or spacing survive. Anything still unrecognised aborts the
-- migration, which is the intended outcome: it means a value nobody accounted
-- for is in the table and needs a decision, not a silent default.
-- ---------------------------------------------------------------------------

UPDATE "Task" SET "status" = upper(replace(trim("status"), ' ', '_'));
ALTER TABLE "Task" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Task" ALTER COLUMN "status" TYPE "TaskStatus" USING "status"::"TaskStatus";
ALTER TABLE "Task" ALTER COLUMN "status" SET DEFAULT 'TODO';

UPDATE "TaskUpdate" SET "type" = upper(replace(trim("type"), ' ', '_'));
ALTER TABLE "TaskUpdate" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "TaskUpdate" ALTER COLUMN "type" TYPE "TaskUpdateType" USING "type"::"TaskUpdateType";
ALTER TABLE "TaskUpdate" ALTER COLUMN "type" SET DEFAULT 'COMMENT';

UPDATE "Blocker" SET "status" = upper(trim("status"));
ALTER TABLE "Blocker" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Blocker" ALTER COLUMN "status" TYPE "BlockerStatus" USING "status"::"BlockerStatus";
ALTER TABLE "Blocker" ALTER COLUMN "status" SET DEFAULT 'OPEN';

UPDATE "Payment" SET "status" = upper(trim("status"));
ALTER TABLE "Payment" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Payment" ALTER COLUMN "status" TYPE "PaymentStatus" USING "status"::"PaymentStatus";
ALTER TABLE "Payment" ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- ---------------------------------------------------------------------------
-- Classify the existing project statuses.
--
-- Behaviour keys off `category` from here on, so renaming a status in Settings
-- no longer breaks completion, archiving, overdue or any report. The names
-- below are the ones this installation ships with; anything else is left as
-- ACTIVE, which is the safe default (a project stays in the live portfolio
-- rather than silently vanishing into the archive).
-- ---------------------------------------------------------------------------

UPDATE "ProjectStatus" SET "category" = 'ACTIVE'   WHERE lower(trim("name")) IN ('active', 'pending', 'in progress');
UPDATE "ProjectStatus" SET "category" = 'ON_HOLD'  WHERE lower(trim("name")) IN ('parked', 'on hold', 'suspended');
UPDATE "ProjectStatus" SET "category" = 'HANDOVER' WHERE lower(trim("name")) IN ('on handover', 'handover');
UPDATE "ProjectStatus" SET "category" = 'CLOSED'   WHERE lower(trim("name")) IN ('completed', 'complete', 'closed', 'cancelled');
