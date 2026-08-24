-- CreateTable
CREATE TABLE "SharedAiUsage" (
    "id" TEXT NOT NULL,
    "provider" "AiProviderKind" NOT NULL,
    "date" DATE NOT NULL,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "exhaustedAt" TIMESTAMP(3),

    CONSTRAINT "SharedAiUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SharedAiUsage_provider_date_key" ON "SharedAiUsage"("provider", "date");
