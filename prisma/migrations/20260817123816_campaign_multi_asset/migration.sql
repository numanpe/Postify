-- CreateEnum
CREATE TYPE "CampaignAssetType" AS ENUM ('POSTER', 'VIDEO');

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "campaignType" TEXT NOT NULL DEFAULT 'General';

-- AlterTable
ALTER TABLE "CampaignItem" ADD COLUMN     "assetType" "CampaignAssetType" NOT NULL DEFAULT 'POSTER',
ADD COLUMN     "captionText" TEXT,
ADD COLUMN     "cta" TEXT,
ADD COLUMN     "hashtags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "headline" TEXT,
ADD COLUMN     "subhead" TEXT,
ADD COLUMN     "suggestedPostAt" TIMESTAMP(3),
ADD COLUMN     "targetPlatforms" "SocialPlatform"[] DEFAULT ARRAY[]::"SocialPlatform"[],
ADD COLUMN     "videoId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "CampaignItem_videoId_key" ON "CampaignItem"("videoId");

-- AddForeignKey
ALTER TABLE "CampaignItem" ADD CONSTRAINT "CampaignItem_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE SET NULL ON UPDATE CASCADE;

