-- AlterTable
ALTER TABLE "subscripion" ADD COLUMN     "postExpiredAt" TIMESTAMP(3),
ADD COLUMN     "remindersEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "warn0At" TIMESTAMP(3),
ADD COLUMN     "warn1At" TIMESTAMP(3),
ADD COLUMN     "warn3At" TIMESTAMP(3),
ADD COLUMN     "warn7At" TIMESTAMP(3);
