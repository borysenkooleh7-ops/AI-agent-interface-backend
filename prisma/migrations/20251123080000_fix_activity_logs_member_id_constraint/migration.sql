-- Fix migration: Add memberId column if it doesn't exist
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
        -- Drop the foreign key constraint if it exists
        IF EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'activity_logs_memberId_fkey'
        ) THEN
            ALTER TABLE "activity_logs" 
            DROP CONSTRAINT "activity_logs_memberId_fkey";
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
        END IF;
    END IF;
END $$;

