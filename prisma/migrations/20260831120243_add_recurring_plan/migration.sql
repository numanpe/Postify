-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "recurringPlanId" TEXT;

-- CreateTable
CREATE TABLE "RecurringPlan" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "postsPerDay" INTEGER NOT NULL DEFAULT 0,
    "videosPerDay" INTEGER NOT NULL DEFAULT 0,
    "publishTimes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "targetPlatforms" "SocialPlatform"[] DEFAULT ARRAY[]::"SocialPlatform"[],
    "objectiveHint" TEXT,
    "autoPublish" BOOLEAN NOT NULL DEFAULT false,
    "isPaused" BOOLEAN NOT NULL DEFAULT false,
    "lastGeneratedDate" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RecurringPlan_companyId_key" ON "RecurringPlan"("companyId");

-- CreateIndex
CREATE INDEX "RecurringPlan_isPaused_lastGeneratedDate_idx" ON "RecurringPlan"("isPaused", "lastGeneratedDate");

-- CreateIndex
CREATE INDEX "Campaign_recurringPlanId_idx" ON "Campaign"("recurringPlanId");

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_recurringPlanId_fkey" FOREIGN KEY ("recurringPlanId") REFERENCES "RecurringPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringPlan" ADD CONSTRAINT "RecurringPlan_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
