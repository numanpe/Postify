-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "websiteUrl" TEXT,
ADD COLUMN     "whatsappNumber" TEXT,
ADD COLUMN     "publicBioEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "publicBioSlug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Company_publicBioSlug_key" ON "Company"("publicBioSlug");
