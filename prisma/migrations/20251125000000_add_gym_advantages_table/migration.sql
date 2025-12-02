-- CreateTable
CREATE TABLE "gym_advantages" (
    "id" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gym_advantages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "gym_advantages_gymId_idx" ON "gym_advantages"("gymId");

-- AddForeignKey
ALTER TABLE "gym_advantages" ADD CONSTRAINT "gym_advantages_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "gyms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

