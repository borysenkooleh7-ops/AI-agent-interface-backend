-- Script to fix the failed migration in production
-- Run this directly in your production database if needed

-- First, ensure the memberId column exists (it might have been added before the failure)
ALTER TABLE "activity_logs" ADD COLUMN IF NOT EXISTS "memberId" TEXT;

-- Remove the foreign key constraint if it exists and members table doesn't exist
DO $$
BEGIN
    -- Check if members table does NOT exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'members'
    ) THEN
        -- Drop the foreign key constraint if it exists (it might have been partially created)
        IF EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'activity_logs_memberId_fkey'
        ) THEN
            ALTER TABLE "activity_logs" 
            DROP CONSTRAINT "activity_logs_memberId_fkey";
            RAISE NOTICE 'Dropped foreign key constraint because members table does not exist';
        END IF;
    ELSE
        -- Members table exists, ensure the foreign key constraint exists
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'activity_logs_memberId_fkey'
        ) THEN
            ALTER TABLE "activity_logs" 
            ADD CONSTRAINT "activity_logs_memberId_fkey" 
            FOREIGN KEY ("memberId") 
            REFERENCES "members"("id") 
            ON DELETE SET NULL 
            ON UPDATE CASCADE;
            RAISE NOTICE 'Added foreign key constraint because members table exists';
        END IF;
    END IF;
END $$;

-- Mark the migration as rolled back in _prisma_migrations table
-- This allows Prisma to retry the migration
UPDATE "_prisma_migrations" 
SET finished_at = NULL, 
    applied_steps_count = 0,
    logs = NULL,
    rolled_back_at = NOW()
WHERE migration_name = '20251123073502_add_member_id_to_activity_logs'
AND finished_at IS NULL;

