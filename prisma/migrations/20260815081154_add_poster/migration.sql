/*
  Warnings:

  - Changed the type of `provider` on the `ProviderCredential` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "AspectRatio" AS ENUM ('SQUARE', 'STORY', 'LANDSCAPE');

-- CreateEnum
CREATE TYPE "BackgroundSource" AS ENUM ('BRAND', 'PHOTO', 'AI');

-- CreateEnum
CREATE TYPE "AiProviderKind" AS ENUM ('OPENAI', 'ANTHROPIC');

-- AlterTable
ALTER TABLE "ProviderCredential" DROP COLUMN "provider",
ADD COLUMN     "provider" "AiProviderKind" NOT NULL;

-- DropEnum
DROP TYPE "TextProviderKind";

-- CreateTable
CREATE TABLE "Poster" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "subhead" TEXT,
    "cta" TEXT,
    "aspectRatio" "AspectRatio" NOT NULL,
    "backgroundSource" "BackgroundSource" NOT NULL,
    "backgroundAssetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Poster_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Poster_assetId_key" ON "Poster"("assetId");

-- CreateIndex
CREATE INDEX "Poster_companyId_idx" ON "Poster"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderCredential_companyId_provider_key" ON "ProviderCredential"("companyId", "provider");

-- AddForeignKey
ALTER TABLE "Poster" ADD CONSTRAINT "Poster_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Poster" ADD CONSTRAINT "Poster_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Poster" ADD CONSTRAINT "Poster_backgroundAssetId_fkey" FOREIGN KEY ("backgroundAssetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
