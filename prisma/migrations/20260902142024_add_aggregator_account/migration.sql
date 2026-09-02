-- CreateTable
CREATE TABLE "AggregatorAccount" (
    "id" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "accountId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AggregatorAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AggregatorAccount_credentialId_idx" ON "AggregatorAccount"("credentialId");

-- CreateIndex
CREATE UNIQUE INDEX "AggregatorAccount_credentialId_platform_accountId_key" ON "AggregatorAccount"("credentialId", "platform", "accountId");

-- AddForeignKey
ALTER TABLE "AggregatorAccount" ADD CONSTRAINT "AggregatorAccount_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "AggregatorCredential"("id") ON DELETE CASCADE ON UPDATE CASCADE;
