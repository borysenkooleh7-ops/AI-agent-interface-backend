-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "RegistrationRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "registration_requests" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "gymId" TEXT NOT NULL,
    "status" "RegistrationRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedBy" TEXT,
    "approvedBy" TEXT,
    "rejectedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "registration_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "registration_requests_status_idx" ON "registration_requests"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "registration_requests_gymId_idx" ON "registration_requests"("gymId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "registration_requests_email_idx" ON "registration_requests"("email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "registration_requests_role_idx" ON "registration_requests"("role");

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'registration_requests_gymId_fkey'
    ) THEN
        ALTER TABLE "registration_requests" 
        ADD CONSTRAINT "registration_requests_gymId_fkey" 
        FOREIGN KEY ("gymId") 
        REFERENCES "gyms"("id") 
        ON DELETE CASCADE 
        ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'registration_requests_approvedBy_fkey'
    ) THEN
        ALTER TABLE "registration_requests" 
        ADD CONSTRAINT "registration_requests_approvedBy_fkey" 
        FOREIGN KEY ("approvedBy") 
        REFERENCES "users"("id") 
        ON DELETE SET NULL 
        ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'registration_requests_rejectedBy_fkey'
    ) THEN
        ALTER TABLE "registration_requests" 
        ADD CONSTRAINT "registration_requests_rejectedBy_fkey" 
        FOREIGN KEY ("rejectedBy") 
        REFERENCES "users"("id") 
        ON DELETE SET NULL 
        ON UPDATE CASCADE;
    END IF;
END $$;

