-- CreateEnum
CREATE TYPE "SignalSource" AS ENUM ('DELETE', 'PUBLISH', 'ENGAGEMENT', 'EDIT', 'REGEN_REJECTED', 'REGEN_CHOSEN', 'LIKE', 'DISLIKE');

-- AlterTable
ALTER TABLE "CreativeDna" ADD COLUMN     "lockedTopics" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "CreativeSignal" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "sourceType" "SignalSource" NOT NULL,
    "strength" DOUBLE PRECISION NOT NULL,
    "topic" TEXT,
    "template" TEXT,
    "tone" TEXT,
    "visualStyle" TEXT,
    "posterId" TEXT,
    "videoId" TEXT,
    "campaignItemId" TEXT,
    "contentFingerprint" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreativeSignal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CreativeSignal_companyId_sourceType_idx" ON "CreativeSignal"("companyId", "sourceType");

-- CreateIndex
CREATE INDEX "CreativeSignal_companyId_contentFingerprint_idx" ON "CreativeSignal"("companyId", "contentFingerprint");

-- AddForeignKey
ALTER TABLE "CreativeSignal" ADD CONSTRAINT "CreativeSignal_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
