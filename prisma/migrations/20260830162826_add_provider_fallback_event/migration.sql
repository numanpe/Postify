-- CreateTable
CREATE TABLE "ProviderFallbackEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "capability" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "fromProvider" TEXT NOT NULL,
    "toProvider" TEXT,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderFallbackEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProviderFallbackEvent_companyId_idx" ON "ProviderFallbackEvent"("companyId");

-- CreateIndex
CREATE INDEX "ProviderFallbackEvent_createdAt_idx" ON "ProviderFallbackEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "ProviderFallbackEvent" ADD CONSTRAINT "ProviderFallbackEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
