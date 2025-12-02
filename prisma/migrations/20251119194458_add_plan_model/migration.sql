-- This migration ensures indexes exist on the plans table
-- The plans table was already created in the initial migration (20251020120424_init)
-- This migration is idempotent and safe to run multiple times

-- CreateIndex: plans_gymId_idx (only if it doesn't exist)
CREATE INDEX IF NOT EXISTS "plans_gymId_idx" ON "plans"("gymId");

-- CreateIndex: plans_active_idx (only if it doesn't exist)
CREATE INDEX IF NOT EXISTS "plans_active_idx" ON "plans"("active");
