-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "MemberStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'ACTIVE', 'INACTIVE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "members" (
    "id" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "leadId" TEXT,
    "planId" TEXT,
    "fullName" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3) NOT NULL,
    "address" TEXT,
    "zipCode" TEXT,
    "preferredWorkoutTime" TEXT,
    "gymGoal" TEXT,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "status" "MemberStatus" NOT NULL DEFAULT 'PENDING',
    "planExpirationDate" TIMESTAMP(3),
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "members_cpf_key" ON "members"("cpf");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "members_gymId_idx" ON "members"("gymId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "members_isDeleted_idx" ON "members"("isDeleted");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "members_status_idx" ON "members"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "members_cpf_idx" ON "members"("cpf");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "members_phone_idx" ON "members"("phone");

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'members_gymId_fkey'
    ) THEN
        ALTER TABLE "members" 
        ADD CONSTRAINT "members_gymId_fkey" 
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
        WHERE conname = 'members_planId_fkey'
    ) THEN
        ALTER TABLE "members" 
        ADD CONSTRAINT "members_planId_fkey" 
        FOREIGN KEY ("planId") 
        REFERENCES "plans"("id") 
        ON DELETE SET NULL 
        ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'members_leadId_fkey'
    ) THEN
        ALTER TABLE "members" 
        ADD CONSTRAINT "members_leadId_fkey" 
        FOREIGN KEY ("leadId") 
        REFERENCES "leads"("id") 
        ON DELETE SET NULL 
        ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'members_approvedBy_fkey'
    ) THEN
        ALTER TABLE "members" 
        ADD CONSTRAINT "members_approvedBy_fkey" 
        FOREIGN KEY ("approvedBy") 
        REFERENCES "users"("id") 
        ON DELETE SET NULL 
        ON UPDATE CASCADE;
    END IF;
END $$;

