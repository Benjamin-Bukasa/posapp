-- AlterTable
ALTER TABLE "supplyRequests" ADD COLUMN     "pdfData" BYTEA,
ADD COLUMN     "pdfFileName" TEXT,
ADD COLUMN     "pdfGeneratedAt" TIMESTAMP(3);
