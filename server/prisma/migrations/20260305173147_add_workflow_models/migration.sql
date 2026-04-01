/*
  Warnings:

  - The `status` column on the `deliveryNotes` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `productTransferts` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `purchaseOrders` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `purchaseRequests` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `requestedBy` on the `supplyRequests` table. All the data in the column will be lost.
  - The `status` column on the `supplyRequests` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[storageZoneId,productId]` on the table `inventory` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `storageZoneId` to the `inventory` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "UnitType" AS ENUM ('DOSAGE', 'SALE', 'STOCK');

-- CreateEnum
CREATE TYPE "StorageZoneType" AS ENUM ('WAREHOUSE', 'STORE', 'COUNTER');

-- CreateEnum
CREATE TYPE "SupplyRequestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'PARTIAL', 'FULFILLED', 'CANCELED');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('DRAFT', 'IN_TRANSIT', 'COMPLETED', 'CANCELED');

-- CreateEnum
CREATE TYPE "PurchaseRequestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'ORDERED', 'CANCELED');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'SENT', 'PARTIAL', 'COMPLETED', 'CANCELED');

-- CreateEnum
CREATE TYPE "DeliveryNoteStatus" AS ENUM ('PENDING', 'RECEIVED', 'PARTIAL', 'CANCELED');

-- CreateEnum
CREATE TYPE "StockEntryStatus" AS ENUM ('PENDING', 'APPROVED', 'POSTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "StockEntrySource" AS ENUM ('DIRECT', 'PURCHASE_ORDER', 'TRANSFER');

-- CreateEnum
CREATE TYPE "InventoryMovementType" AS ENUM ('IN', 'OUT', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT');

-- DropIndex
DROP INDEX "inventory_storeId_productId_key";

-- AlterTable
ALTER TABLE "deliveryNotes" ADD COLUMN     "note" TEXT,
ADD COLUMN     "purchaseOrderId" TEXT,
ADD COLUMN     "receivedAt" TIMESTAMP(3),
ADD COLUMN     "receivedById" TEXT,
ADD COLUMN     "supplierId" TEXT,
DROP COLUMN "status",
ADD COLUMN     "status" "DeliveryNoteStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "inventory" ADD COLUMN     "storageZoneId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "productTransferts" ADD COLUMN     "fromZoneId" TEXT,
ADD COLUMN     "note" TEXT,
ADD COLUMN     "requestedById" TEXT,
ADD COLUMN     "toZoneId" TEXT,
DROP COLUMN "status",
ADD COLUMN     "status" "TransferStatus" NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "dosageUnitId" TEXT,
ADD COLUMN     "saleUnitId" TEXT,
ADD COLUMN     "stockUnitId" TEXT;

-- AlterTable
ALTER TABLE "purchaseOrders" ADD COLUMN     "expectedDate" TIMESTAMP(3),
ADD COLUMN     "note" TEXT,
ADD COLUMN     "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "orderedById" TEXT,
ADD COLUMN     "purchaseRequestId" TEXT,
ADD COLUMN     "storeId" TEXT,
ADD COLUMN     "supplierId" TEXT,
DROP COLUMN "status",
ADD COLUMN     "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "purchaseRequests" ADD COLUMN     "note" TEXT,
ADD COLUMN     "requestedById" TEXT,
ADD COLUMN     "storeId" TEXT,
ADD COLUMN     "supplyRequestId" TEXT,
DROP COLUMN "status",
ADD COLUMN     "status" "PurchaseRequestStatus" NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "storageZone" ADD COLUMN     "code" TEXT,
ADD COLUMN     "zoneType" "StorageZoneType" NOT NULL DEFAULT 'STORE';

-- AlterTable
ALTER TABLE "supplyRequests" DROP COLUMN "requestedBy",
ADD COLUMN     "note" TEXT,
ADD COLUMN     "requestedById" TEXT,
ADD COLUMN     "storageZoneId" TEXT,
ADD COLUMN     "storeId" TEXT,
DROP COLUMN "status",
ADD COLUMN     "status" "SupplyRequestStatus" NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "defaultStorageZoneId" TEXT;

-- CreateTable
CREATE TABLE "units" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "UnitType" NOT NULL,
    "symbol" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productComponents" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "componentProductId" TEXT,
    "componentName" TEXT,
    "dosageUnitId" TEXT,
    "quantity" DECIMAL(12,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "productComponents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productUnitConversions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "fromUnitId" TEXT NOT NULL,
    "toUnitId" TEXT NOT NULL,
    "factor" DECIMAL(12,6) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "productUnitConversions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "addressLine" TEXT,
    "city" TEXT,
    "country" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approvalFlows" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approvalFlows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approvalFlowSteps" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "approverRole" "UserRole",
    "approverUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approvalFlowSteps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplyRequestItems" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "supplyRequestId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "unitId" TEXT,
    "quantity" DECIMAL(12,4) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplyRequestItems_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplyRequestApprovals" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "supplyRequestId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "approverId" TEXT,
    "approverRole" "UserRole",
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "decidedAt" TIMESTAMP(3),
    "note" TEXT,

    CONSTRAINT "supplyRequestApprovals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productTransferItems" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "unitId" TEXT,
    "quantity" DECIMAL(12,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "productTransferItems_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchaseRequestItems" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "purchaseRequestId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "unitId" TEXT,
    "quantity" DECIMAL(12,4) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchaseRequestItems_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchaseRequestApprovals" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "purchaseRequestId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "approverId" TEXT,
    "approverRole" "UserRole",
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "decidedAt" TIMESTAMP(3),
    "note" TEXT,

    CONSTRAINT "purchaseRequestApprovals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchaseOrderItems" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "unitId" TEXT,
    "quantity" DECIMAL(12,4) NOT NULL,
    "unitPrice" DECIMAL(12,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchaseOrderItems_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deliveryNoteItems" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "deliveryNoteId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "unitId" TEXT,
    "orderedQty" DECIMAL(12,4),
    "deliveredQty" DECIMAL(12,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deliveryNoteItems_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stockEntries" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sourceType" "StockEntrySource" NOT NULL,
    "sourceId" TEXT,
    "storeId" TEXT,
    "storageZoneId" TEXT NOT NULL,
    "status" "StockEntryStatus" NOT NULL DEFAULT 'PENDING',
    "createdById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "postedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stockEntries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stockEntryItems" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "stockEntryId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "unitId" TEXT,
    "quantity" DECIMAL(12,4) NOT NULL,
    "unitCost" DECIMAL(12,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stockEntryItems_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventoryMovements" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "storageZoneId" TEXT NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,
    "movementType" "InventoryMovementType" NOT NULL,
    "sourceType" "StockEntrySource",
    "sourceId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventoryMovements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "units_tenantId_idx" ON "units"("tenantId");

-- CreateIndex
CREATE INDEX "productComponents_tenantId_idx" ON "productComponents"("tenantId");

-- CreateIndex
CREATE INDEX "productComponents_productId_idx" ON "productComponents"("productId");

-- CreateIndex
CREATE INDEX "productUnitConversions_tenantId_idx" ON "productUnitConversions"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "productUnitConversions_productId_fromUnitId_toUnitId_key" ON "productUnitConversions"("productId", "fromUnitId", "toUnitId");

-- CreateIndex
CREATE INDEX "suppliers_tenantId_idx" ON "suppliers"("tenantId");

-- CreateIndex
CREATE INDEX "approvalFlows_tenantId_idx" ON "approvalFlows"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "approvalFlows_tenantId_code_key" ON "approvalFlows"("tenantId", "code");

-- CreateIndex
CREATE INDEX "approvalFlowSteps_tenantId_idx" ON "approvalFlowSteps"("tenantId");

-- CreateIndex
CREATE INDEX "approvalFlowSteps_flowId_idx" ON "approvalFlowSteps"("flowId");

-- CreateIndex
CREATE INDEX "supplyRequestItems_tenantId_idx" ON "supplyRequestItems"("tenantId");

-- CreateIndex
CREATE INDEX "supplyRequestItems_supplyRequestId_idx" ON "supplyRequestItems"("supplyRequestId");

-- CreateIndex
CREATE INDEX "supplyRequestApprovals_tenantId_idx" ON "supplyRequestApprovals"("tenantId");

-- CreateIndex
CREATE INDEX "supplyRequestApprovals_supplyRequestId_idx" ON "supplyRequestApprovals"("supplyRequestId");

-- CreateIndex
CREATE INDEX "productTransferItems_tenantId_idx" ON "productTransferItems"("tenantId");

-- CreateIndex
CREATE INDEX "productTransferItems_transferId_idx" ON "productTransferItems"("transferId");

-- CreateIndex
CREATE INDEX "purchaseRequestItems_tenantId_idx" ON "purchaseRequestItems"("tenantId");

-- CreateIndex
CREATE INDEX "purchaseRequestItems_purchaseRequestId_idx" ON "purchaseRequestItems"("purchaseRequestId");

-- CreateIndex
CREATE INDEX "purchaseRequestApprovals_tenantId_idx" ON "purchaseRequestApprovals"("tenantId");

-- CreateIndex
CREATE INDEX "purchaseRequestApprovals_purchaseRequestId_idx" ON "purchaseRequestApprovals"("purchaseRequestId");

-- CreateIndex
CREATE INDEX "purchaseOrderItems_tenantId_idx" ON "purchaseOrderItems"("tenantId");

-- CreateIndex
CREATE INDEX "purchaseOrderItems_purchaseOrderId_idx" ON "purchaseOrderItems"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "deliveryNoteItems_tenantId_idx" ON "deliveryNoteItems"("tenantId");

-- CreateIndex
CREATE INDEX "deliveryNoteItems_deliveryNoteId_idx" ON "deliveryNoteItems"("deliveryNoteId");

-- CreateIndex
CREATE INDEX "stockEntries_tenantId_idx" ON "stockEntries"("tenantId");

-- CreateIndex
CREATE INDEX "stockEntries_storageZoneId_idx" ON "stockEntries"("storageZoneId");

-- CreateIndex
CREATE INDEX "stockEntryItems_tenantId_idx" ON "stockEntryItems"("tenantId");

-- CreateIndex
CREATE INDEX "stockEntryItems_stockEntryId_idx" ON "stockEntryItems"("stockEntryId");

-- CreateIndex
CREATE INDEX "inventoryMovements_tenantId_idx" ON "inventoryMovements"("tenantId");

-- CreateIndex
CREATE INDEX "inventoryMovements_storageZoneId_idx" ON "inventoryMovements"("storageZoneId");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_storageZoneId_productId_key" ON "inventory"("storageZoneId", "productId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_defaultStorageZoneId_fkey" FOREIGN KEY ("defaultStorageZoneId") REFERENCES "storageZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "units" ADD CONSTRAINT "units_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productComponents" ADD CONSTRAINT "productComponents_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productComponents" ADD CONSTRAINT "productComponents_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productComponents" ADD CONSTRAINT "productComponents_componentProductId_fkey" FOREIGN KEY ("componentProductId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productComponents" ADD CONSTRAINT "productComponents_dosageUnitId_fkey" FOREIGN KEY ("dosageUnitId") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productUnitConversions" ADD CONSTRAINT "productUnitConversions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productUnitConversions" ADD CONSTRAINT "productUnitConversions_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productUnitConversions" ADD CONSTRAINT "productUnitConversions_fromUnitId_fkey" FOREIGN KEY ("fromUnitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productUnitConversions" ADD CONSTRAINT "productUnitConversions_toUnitId_fkey" FOREIGN KEY ("toUnitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_saleUnitId_fkey" FOREIGN KEY ("saleUnitId") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_stockUnitId_fkey" FOREIGN KEY ("stockUnitId") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_dosageUnitId_fkey" FOREIGN KEY ("dosageUnitId") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvalFlows" ADD CONSTRAINT "approvalFlows_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvalFlowSteps" ADD CONSTRAINT "approvalFlowSteps_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvalFlowSteps" ADD CONSTRAINT "approvalFlowSteps_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "approvalFlows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvalFlowSteps" ADD CONSTRAINT "approvalFlowSteps_approverUserId_fkey" FOREIGN KEY ("approverUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplyRequests" ADD CONSTRAINT "supplyRequests_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplyRequests" ADD CONSTRAINT "supplyRequests_storageZoneId_fkey" FOREIGN KEY ("storageZoneId") REFERENCES "storageZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplyRequests" ADD CONSTRAINT "supplyRequests_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplyRequestItems" ADD CONSTRAINT "supplyRequestItems_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplyRequestItems" ADD CONSTRAINT "supplyRequestItems_supplyRequestId_fkey" FOREIGN KEY ("supplyRequestId") REFERENCES "supplyRequests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplyRequestItems" ADD CONSTRAINT "supplyRequestItems_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplyRequestItems" ADD CONSTRAINT "supplyRequestItems_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplyRequestApprovals" ADD CONSTRAINT "supplyRequestApprovals_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplyRequestApprovals" ADD CONSTRAINT "supplyRequestApprovals_supplyRequestId_fkey" FOREIGN KEY ("supplyRequestId") REFERENCES "supplyRequests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplyRequestApprovals" ADD CONSTRAINT "supplyRequestApprovals_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productTransferts" ADD CONSTRAINT "productTransferts_fromZoneId_fkey" FOREIGN KEY ("fromZoneId") REFERENCES "storageZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productTransferts" ADD CONSTRAINT "productTransferts_toZoneId_fkey" FOREIGN KEY ("toZoneId") REFERENCES "storageZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productTransferts" ADD CONSTRAINT "productTransferts_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productTransferItems" ADD CONSTRAINT "productTransferItems_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productTransferItems" ADD CONSTRAINT "productTransferItems_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "productTransferts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productTransferItems" ADD CONSTRAINT "productTransferItems_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productTransferItems" ADD CONSTRAINT "productTransferItems_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchaseRequests" ADD CONSTRAINT "purchaseRequests_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchaseRequests" ADD CONSTRAINT "purchaseRequests_supplyRequestId_fkey" FOREIGN KEY ("supplyRequestId") REFERENCES "supplyRequests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchaseRequests" ADD CONSTRAINT "purchaseRequests_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchaseRequestItems" ADD CONSTRAINT "purchaseRequestItems_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchaseRequestItems" ADD CONSTRAINT "purchaseRequestItems_purchaseRequestId_fkey" FOREIGN KEY ("purchaseRequestId") REFERENCES "purchaseRequests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchaseRequestItems" ADD CONSTRAINT "purchaseRequestItems_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchaseRequestItems" ADD CONSTRAINT "purchaseRequestItems_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchaseRequestApprovals" ADD CONSTRAINT "purchaseRequestApprovals_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchaseRequestApprovals" ADD CONSTRAINT "purchaseRequestApprovals_purchaseRequestId_fkey" FOREIGN KEY ("purchaseRequestId") REFERENCES "purchaseRequests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchaseRequestApprovals" ADD CONSTRAINT "purchaseRequestApprovals_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchaseOrders" ADD CONSTRAINT "purchaseOrders_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchaseOrders" ADD CONSTRAINT "purchaseOrders_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchaseOrders" ADD CONSTRAINT "purchaseOrders_purchaseRequestId_fkey" FOREIGN KEY ("purchaseRequestId") REFERENCES "purchaseRequests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchaseOrders" ADD CONSTRAINT "purchaseOrders_orderedById_fkey" FOREIGN KEY ("orderedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchaseOrderItems" ADD CONSTRAINT "purchaseOrderItems_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchaseOrderItems" ADD CONSTRAINT "purchaseOrderItems_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchaseOrders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchaseOrderItems" ADD CONSTRAINT "purchaseOrderItems_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchaseOrderItems" ADD CONSTRAINT "purchaseOrderItems_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveryNotes" ADD CONSTRAINT "deliveryNotes_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveryNotes" ADD CONSTRAINT "deliveryNotes_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchaseOrders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveryNotes" ADD CONSTRAINT "deliveryNotes_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveryNoteItems" ADD CONSTRAINT "deliveryNoteItems_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveryNoteItems" ADD CONSTRAINT "deliveryNoteItems_deliveryNoteId_fkey" FOREIGN KEY ("deliveryNoteId") REFERENCES "deliveryNotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveryNoteItems" ADD CONSTRAINT "deliveryNoteItems_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveryNoteItems" ADD CONSTRAINT "deliveryNoteItems_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_storageZoneId_fkey" FOREIGN KEY ("storageZoneId") REFERENCES "storageZone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stockEntries" ADD CONSTRAINT "stockEntries_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stockEntries" ADD CONSTRAINT "stockEntries_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stockEntries" ADD CONSTRAINT "stockEntries_storageZoneId_fkey" FOREIGN KEY ("storageZoneId") REFERENCES "storageZone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stockEntries" ADD CONSTRAINT "stockEntries_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stockEntries" ADD CONSTRAINT "stockEntries_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stockEntryItems" ADD CONSTRAINT "stockEntryItems_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stockEntryItems" ADD CONSTRAINT "stockEntryItems_stockEntryId_fkey" FOREIGN KEY ("stockEntryId") REFERENCES "stockEntries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stockEntryItems" ADD CONSTRAINT "stockEntryItems_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stockEntryItems" ADD CONSTRAINT "stockEntryItems_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventoryMovements" ADD CONSTRAINT "inventoryMovements_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventoryMovements" ADD CONSTRAINT "inventoryMovements_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventoryMovements" ADD CONSTRAINT "inventoryMovements_storageZoneId_fkey" FOREIGN KEY ("storageZoneId") REFERENCES "storageZone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventoryMovements" ADD CONSTRAINT "inventoryMovements_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
