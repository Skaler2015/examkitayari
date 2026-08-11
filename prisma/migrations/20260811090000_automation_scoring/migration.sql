-- AlterEnum
ALTER TYPE "ContentCategory" ADD VALUE 'CURRENT_AFFAIRS';

-- AlterEnum
ALTER TYPE "VerificationStatus" ADD VALUE 'AI_VERIFIED';

-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "qualityScore" INTEGER,
ADD COLUMN     "reviewReason" TEXT;

-- AlterTable
ALTER TABLE "AutomationSetting" ADD COLUMN     "minPublishScore" INTEGER NOT NULL DEFAULT 80,
ADD COLUMN     "sourceDiscovery" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Source" ADD COLUMN     "reliabilityScore" INTEGER;

-- AlterTable
ALTER TABLE "SourceItem" ADD COLUMN     "qualityScore" INTEGER;

