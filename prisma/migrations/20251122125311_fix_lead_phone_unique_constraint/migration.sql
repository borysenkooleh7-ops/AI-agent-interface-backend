-- Fix Lead phone unique constraint for multi-tenant support
-- Change from global unique to composite unique constraint (gymId, phone)
-- This allows the same phone number to exist across different gyms

-- Step 1: Drop the existing unique constraint on phone
DROP INDEX IF EXISTS "leads_phone_key";

-- Step 2: Create composite unique constraint on (gymId, phone)
-- Use IF NOT EXISTS to make this migration idempotent
DO $$
BEGIN
    -- Check if the constraint doesn't already exist
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'leads_gymId_phone_key'
        AND conrelid = 'leads'::regclass
    ) THEN
        -- Create the unique constraint
        ALTER TABLE "leads"
        ADD CONSTRAINT "leads_gymId_phone_key" UNIQUE ("gymId", "phone");
    END IF;
END $$;
