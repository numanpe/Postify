-- AlterEnum
ALTER TYPE "PosterTemplate" ADD VALUE 'INFOGRAPHIC_SHOWCASE';

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "contactEmail" TEXT,
ADD COLUMN     "phone" TEXT;
