-- Record who changed a setting, and when.
--
-- The table held a key and a value and nothing else, so "who relaxed the
-- password policy, and when" had no answer. For a security control that is the
-- first question anyone asks.
--
-- Existing rows keep their value; they get the migration's timestamp and no
-- author, which is honest — nobody knows who set them.

ALTER TABLE "Setting"
  ADD COLUMN "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedById" TEXT;

-- SetNull: removing a person must not delete the record of a setting they
-- changed, and must not delete the setting itself.
ALTER TABLE "Setting"
  ADD CONSTRAINT "Setting_updatedById_fkey"
    FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
