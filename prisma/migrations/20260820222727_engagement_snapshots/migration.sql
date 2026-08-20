-- CreateTable
CREATE TABLE "EngagementSnapshot" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "publishJobId" TEXT NOT NULL,
    "likes" INTEGER NOT NULL,
    "comments" INTEGER NOT NULL,
    "shares" INTEGER NOT NULL,
    "reach" INTEGER,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EngagementSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EngagementSnapshot_companyId_idx" ON "EngagementSnapshot"("companyId");

-- CreateIndex
CREATE INDEX "EngagementSnapshot_publishJobId_idx" ON "EngagementSnapshot"("publishJobId");

-- AddForeignKey
ALTER TABLE "EngagementSnapshot" ADD CONSTRAINT "EngagementSnapshot_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EngagementSnapshot" ADD CONSTRAINT "EngagementSnapshot_publishJobId_fkey" FOREIGN KEY ("publishJobId") REFERENCES "PublishJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
