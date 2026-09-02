-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "lastWeeklyDigestSentAt" TIMESTAMP(3),
ADD COLUMN     "weeklyDigestEnabled" BOOLEAN NOT NULL DEFAULT true;
