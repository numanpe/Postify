-- CreateEnum
CREATE TYPE "VoiceEngine" AS ENUM ('FREE', 'BYOK');

-- AlterEnum
ALTER TYPE "AiProviderKind" ADD VALUE 'ELEVENLABS';

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "voiceEngine" "VoiceEngine" NOT NULL DEFAULT 'FREE';
