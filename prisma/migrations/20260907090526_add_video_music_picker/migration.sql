-- CreateEnum
CREATE TYPE "VideoMusicMood" AS ENUM ('CALM', 'CONFIDENT', 'UPBEAT', 'WARM');

-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "musicTrack" "VideoMusicMood",
ADD COLUMN     "musicVolume" INTEGER NOT NULL DEFAULT 100;
