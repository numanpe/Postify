-- AlterTable
ALTER TABLE "Poster" ADD COLUMN     "editInstruction" TEXT,
ADD COLUMN     "overrideAccentColor" TEXT,
ADD COLUMN     "overridePrimaryColor" TEXT,
ADD COLUMN     "overrideSecondaryColor" TEXT,
ADD COLUMN     "parentPosterId" TEXT;

-- AddForeignKey
ALTER TABLE "Poster" ADD CONSTRAINT "Poster_parentPosterId_fkey" FOREIGN KEY ("parentPosterId") REFERENCES "Poster"("id") ON DELETE SET NULL ON UPDATE CASCADE;
