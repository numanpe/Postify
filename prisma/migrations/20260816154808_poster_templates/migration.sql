-- CreateEnum
CREATE TYPE "PosterTemplate" AS ENUM ('MINIMAL', 'BOLD_HEADLINE', 'PROMOTIONAL_BANNER', 'SPLIT_PRODUCT');

-- AlterTable
ALTER TABLE "Poster" ADD COLUMN     "template" "PosterTemplate" NOT NULL DEFAULT 'MINIMAL';
