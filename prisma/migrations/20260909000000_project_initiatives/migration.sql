-- Strategic initiatives, and the project that delivers against one.
--
-- Initiatives are maintained in their own section, exactly as departments are.
-- The project form selects from these rows and never creates one, so the list
-- is agreed in a single place before any project can claim it.
--
-- Purely additive: `Project.initiativeId` is nullable, so every existing
-- project keeps its current shape and simply has no initiative until somebody
-- chooses one.

-- CreateTable
CREATE TABLE "Initiative" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Initiative_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Initiative_name_key" ON "Initiative"("name");

-- AlterTable
ALTER TABLE "Project" ADD COLUMN "initiativeId" TEXT;

-- CreateIndex
CREATE INDEX "Project_initiativeId_idx" ON "Project"("initiativeId");

-- AddForeignKey
-- ON DELETE SET NULL rather than CASCADE: retiring an initiative must never
-- delete the projects that were delivered under it.
ALTER TABLE "Project" ADD CONSTRAINT "Project_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "Initiative"("id") ON DELETE SET NULL ON UPDATE CASCADE;
