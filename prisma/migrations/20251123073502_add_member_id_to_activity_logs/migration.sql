-- Add memberId column to activity_logs table
ALTER TABLE "activity_logs" ADD COLUMN IF NOT EXISTS "memberId" TEXT;

-- Add foreign key constraint for memberId only if members table exists
DO $$
BEGIN
    -- Check if members table exists
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'members'
    ) THEN
        -- Only add foreign key constraint if members table exists and constraint doesn't exist
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

