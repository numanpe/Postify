-- CreateEnum
CREATE TYPE "PublishingMode" AS ENUM ('MANUAL', 'AGGREGATOR', 'DIRECT_API');

-- CreateEnum
CREATE TYPE "SocialAggregatorProvider" AS ENUM ('ZERNIO', 'POSTPROXY', 'UPLOAD_POST', 'BUFFER');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "publishingMode" "PublishingMode" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "selectedAggregator" "SocialAggregatorProvider";

-- AlterTable
ALTER TABLE "MediaAsset" ADD COLUMN     "downloadedAt" TIMESTAMP(3),
ADD COLUMN     "retentionExtendedAt" TIMESTAMP(3),
ADD COLUMN     "staleFlaggedAt" TIMESTAMP(3),
ADD COLUMN     "storageDeletedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AggregatorCredential" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "provider" "SocialAggregatorProvider" NOT NULL,
    "encryptedKey" TEXT NOT NULL,
    "keyPreview" TEXT NOT NULL,
    "accountMap" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AggregatorCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AggregatorPublishLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "campaignItemId" TEXT NOT NULL,
    "provider" "SocialAggregatorProvider" NOT NULL,
    "succeeded" BOOLEAN NOT NULL,
    "externalPostId" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AggregatorPublishLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AggregatorCredential_companyId_provider_key" ON "AggregatorCredential"("companyId", "provider");

-- CreateIndex
CREATE INDEX "AggregatorPublishLog_companyId_idx" ON "AggregatorPublishLog"("companyId");

-- CreateIndex
CREATE INDEX "AggregatorPublishLog_campaignItemId_idx" ON "AggregatorPublishLog"("campaignItemId");

-- AddForeignKey
ALTER TABLE "AggregatorCredential" ADD CONSTRAINT "AggregatorCredential_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AggregatorPublishLog" ADD CONSTRAINT "AggregatorPublishLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AggregatorPublishLog" ADD CONSTRAINT "AggregatorPublishLog_campaignItemId_fkey" FOREIGN KEY ("campaignItemId") REFERENCES "CampaignItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
