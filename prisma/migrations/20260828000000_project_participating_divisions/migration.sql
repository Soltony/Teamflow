-- Divisions that contribute to a project without owning it.
--
-- `Project.pmoDivisionId` stays exactly as it was: one accountable owner.
-- This join records the others, so a project delivered by three divisions is
-- no longer visible to only one of them. Purely additive — existing rows keep
-- their owner and simply have no participants.

-- CreateTable
CREATE TABLE "_ProjectParticipatingDivisions" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_ProjectParticipatingDivisions_AB_unique" ON "_ProjectParticipatingDivisions"("A", "B");

-- CreateIndex
CREATE INDEX "_ProjectParticipatingDivisions_B_index" ON "_ProjectParticipatingDivisions"("B");

-- AddForeignKey
ALTER TABLE "_ProjectParticipatingDivisions" ADD CONSTRAINT "_ProjectParticipatingDivisions_A_fkey" FOREIGN KEY ("A") REFERENCES "PmoDivision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProjectParticipatingDivisions" ADD CONSTRAINT "_ProjectParticipatingDivisions_B_fkey" FOREIGN KEY ("B") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
