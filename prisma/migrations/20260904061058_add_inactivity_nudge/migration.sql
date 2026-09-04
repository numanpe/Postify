-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "inactivityNudgeEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lastInactivityNudgeSentAt" TIMESTAMP(3);
