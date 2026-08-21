-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SocialPlatform" ADD VALUE 'LINKEDIN';
ALTER TYPE "SocialPlatform" ADD VALUE 'TIKTOK';

-- AlterTable
ALTER TABLE "PublishJob" ADD COLUMN     "videoId" TEXT;

-- AddForeignKey
ALTER TABLE "PublishJob" ADD CONSTRAINT "PublishJob_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE SET NULL ON UPDATE CASCADE;
