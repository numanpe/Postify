-- CreateEnum
CREATE TYPE "VideoTemplate" AS ENUM ('STANDARD', 'LOWER_THIRD_PROMO', 'WAVEFORM_CAPTIONS');

-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "template" "VideoTemplate" NOT NULL DEFAULT 'STANDARD';
