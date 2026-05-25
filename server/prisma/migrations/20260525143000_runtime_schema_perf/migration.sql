-- Runtime ensure* structures migrated to SQL.
-- Kept idempotent with IF NOT EXISTS so it can be applied safely on existing databases.

ALTER TABLE "tenants"
ADD COLUMN IF NOT EXISTS "primaryCurrencyCode" TEXT NOT NULL DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS "secondaryCurrencyCode" TEXT,
ADD COLUMN IF NOT EXISTS "exchangeRate" DECIMAL(18, 6);

CREATE TABLE IF NOT EXISTS "tenantCurrencies" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "symbol" TEXT,
  "isCurrent" BOOLEAN NOT NULL DEFAULT false,
  "isSecondary" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "tenantCurrencies_tenantId_code_key"
ON "tenantCurrencies" ("tenantId", "code");

CREATE TABLE IF NOT EXISTS "tenantCurrencyConversions" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "fromCurrencyCode" TEXT NOT NULL,
  "toCurrencyCode" TEXT NOT NULL,
  "rate" DECIMAL(18, 6) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "tenantCurrencyConversions_tenant_pair_key"
ON "tenantCurrencyConversions" ("tenantId", "fromCurrencyCode", "toCurrencyCode");

ALTER TABLE "products"
ADD COLUMN IF NOT EXISTS "purchaseUnitPrice" DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS "tvaId" TEXT,
ADD COLUMN IF NOT EXISTS "subFamilyId" TEXT,
ADD COLUMN IF NOT EXISTS "minLevel" DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS "maxLevel" DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;

CREATE INDEX IF NOT EXISTS "products_tvaId_idx"
ON "products" ("tvaId");

CREATE INDEX IF NOT EXISTS "products_subFamilyId_idx"
ON "products" ("subFamilyId");

CREATE UNIQUE INDEX IF NOT EXISTS "products_tenantId_scanCode_key"
ON "products" ("tenantId", "scanCode");

CREATE TABLE IF NOT EXISTS "taxRates" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT,
  "rate" DECIMAL(10, 2) NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "taxRates_tenantId_idx"
ON "taxRates" ("tenantId");

CREATE TABLE IF NOT EXISTS "productCollections" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "productCollections_tenantId_idx"
ON "productCollections" ("tenantId");

ALTER TABLE "productCategories"
ADD COLUMN IF NOT EXISTS "collectionId" TEXT;

ALTER TABLE "productFamilies"
ADD COLUMN IF NOT EXISTS "categoryId" TEXT,
ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'FAMILY',
ADD COLUMN IF NOT EXISTS "parentFamilyId" TEXT;

UPDATE "productFamilies"
SET "kind" = 'FAMILY'
WHERE "kind" IS NULL OR "kind" = '';

CREATE INDEX IF NOT EXISTS "productCategories_collectionId_idx"
ON "productCategories" ("collectionId");

CREATE INDEX IF NOT EXISTS "productFamilies_categoryId_idx"
ON "productFamilies" ("categoryId");

CREATE INDEX IF NOT EXISTS "productFamilies_tenantId_kind_idx"
ON "productFamilies" ("tenantId", "kind");

CREATE INDEX IF NOT EXISTS "productFamilies_parentFamilyId_idx"
ON "productFamilies" ("parentFamilyId");

ALTER TABLE "payements"
ADD COLUMN IF NOT EXISTS "originalAmount" DECIMAL(18, 2),
ADD COLUMN IF NOT EXISTS "originalCurrencyCode" TEXT;

CREATE TABLE IF NOT EXISTS "customerBonusPrograms" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "amountThreshold" DECIMAL(18, 2) NOT NULL DEFAULT 10,
  "pointsAwarded" INTEGER NOT NULL DEFAULT 1,
  "pointValueAmount" DECIMAL(18, 2) NOT NULL DEFAULT 0,
  "quotaPoints" INTEGER,
  "quotaPeriodDays" INTEGER,
  "quotaRewardAmount" DECIMAL(18, 2),
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "customerBonusPrograms_tenantId_idx"
ON "customerBonusPrograms" ("tenantId");

CREATE TABLE IF NOT EXISTS permission_profiles (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  description TEXT,
  permissions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT permission_profiles_tenant_name_unique UNIQUE (tenant_id, name),
  CONSTRAINT permission_profiles_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

ALTER TABLE permission_profiles
DROP CONSTRAINT IF EXISTS permission_profiles_role_check;

ALTER TABLE permission_profiles
ADD CONSTRAINT permission_profiles_role_check
CHECK (role IN ('ADMIN', 'MANAGER', 'USER', 'SELLER'));

CREATE TABLE IF NOT EXISTS user_permission_profiles (
  user_id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_permission_profiles_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT user_permission_profiles_profile_fk FOREIGN KEY (profile_id) REFERENCES permission_profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_permission_profiles_tenant_id
ON permission_profiles (tenant_id);

CREATE INDEX IF NOT EXISTS idx_user_permission_profiles_profile_id
ON user_permission_profiles (profile_id);

CREATE TABLE IF NOT EXISTS "inventoryLots" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "storageZoneId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "batchNumber" TEXT,
  "expiryDate" TIMESTAMPTZ,
  "manufacturedAt" TIMESTAMPTZ,
  "unitCost" DECIMAL(18, 4),
  "quantity" DECIMAL(18, 4) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "inventoryLots_tenant_fk" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "inventoryLots_store_fk" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE,
  CONSTRAINT "inventoryLots_zone_fk" FOREIGN KEY ("storageZoneId") REFERENCES "storageZone"("id") ON DELETE CASCADE,
  CONSTRAINT "inventoryLots_product_fk" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "stockEntryItemLots" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "stockEntryItemId" TEXT NOT NULL,
  "batchNumber" TEXT,
  "expiryDate" TIMESTAMPTZ,
  "manufacturedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "stockEntryItemLots_tenant_fk" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "stockEntryItemLots_entry_fk" FOREIGN KEY ("stockEntryItemId") REFERENCES "stockEntryItems"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "stockEntryItemLots_entry_unique"
ON "stockEntryItemLots" ("stockEntryItemId");

CREATE INDEX IF NOT EXISTS "inventoryLots_zone_product_idx"
ON "inventoryLots" ("storageZoneId", "productId", "expiryDate");

CREATE INDEX IF NOT EXISTS "inventoryLots_tenant_store_idx"
ON "inventoryLots" ("tenantId", "storeId", "updatedAt");

CREATE TABLE IF NOT EXISTS "inventoryLotAlertStates" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "inventoryLotId" TEXT NOT NULL,
  "lastStatus" TEXT NOT NULL DEFAULT 'SANS_DATE',
  "lastNotifiedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "inventoryLotAlertStates_tenant_fk" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "inventoryLotAlertStates_lot_unique"
ON "inventoryLotAlertStates" ("inventoryLotId");

CREATE TABLE IF NOT EXISTS "cashSessions" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "storageZoneId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "openingFloat" DECIMAL(18, 2) NOT NULL DEFAULT 0,
  "openingNote" TEXT,
  "totalCashSales" DECIMAL(18, 2) NOT NULL DEFAULT 0,
  "totalNonCashSales" DECIMAL(18, 2) NOT NULL DEFAULT 0,
  "totalCashIn" DECIMAL(18, 2) NOT NULL DEFAULT 0,
  "totalCashOut" DECIMAL(18, 2) NOT NULL DEFAULT 0,
  "expectedCash" DECIMAL(18, 2),
  "closingCounted" DECIMAL(18, 2),
  "closingNote" TEXT,
  "variance" DECIMAL(18, 2),
  "openedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "closedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "cashSessions_status_check" CHECK ("status" IN ('OPEN', 'CLOSED')),
  CONSTRAINT "cashSessions_tenant_fk" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "cashSessions_store_fk" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE,
  CONSTRAINT "cashSessions_user_fk" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "cashSessions_zone_fk" FOREIGN KEY ("storageZoneId") REFERENCES "storageZone"("id") ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS "cashSessionPayments" (
  "paymentId" TEXT PRIMARY KEY,
  "cashSessionId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "cashSessionPayments_payment_fk" FOREIGN KEY ("paymentId") REFERENCES "payements"("id") ON DELETE CASCADE,
  CONSTRAINT "cashSessionPayments_session_fk" FOREIGN KEY ("cashSessionId") REFERENCES "cashSessions"("id") ON DELETE CASCADE,
  CONSTRAINT "cashSessionPayments_tenant_fk" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "cashMovements" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "cashSessionId" TEXT NOT NULL,
  "createdById" TEXT,
  "type" TEXT NOT NULL,
  "amount" DECIMAL(18, 2) NOT NULL,
  "reason" TEXT NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "cashMovements_type_check" CHECK ("type" IN ('IN', 'OUT')),
  CONSTRAINT "cashMovements_tenant_fk" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "cashMovements_session_fk" FOREIGN KEY ("cashSessionId") REFERENCES "cashSessions"("id") ON DELETE CASCADE,
  CONSTRAINT "cashMovements_created_by_fk" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "cashSessions_tenant_status_idx"
ON "cashSessions" ("tenantId", "status", "openedAt");

CREATE UNIQUE INDEX IF NOT EXISTS "cashSessions_open_user_unique"
ON "cashSessions" ("tenantId", "userId")
WHERE "status" = 'OPEN';

CREATE INDEX IF NOT EXISTS "cashMovements_session_idx"
ON "cashMovements" ("cashSessionId", "createdAt");

CREATE INDEX IF NOT EXISTS "cashSessionPayments_session_idx"
ON "cashSessionPayments" ("cashSessionId");

CREATE TABLE IF NOT EXISTS "inventorySessions" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "storageZoneId" TEXT NOT NULL,
  "requestedById" TEXT,
  "closedById" TEXT,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "note" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "closedAt" TIMESTAMPTZ,
  CONSTRAINT "inventorySessions_status_check" CHECK ("status" IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CLOSED')),
  CONSTRAINT "inventorySessions_tenant_fk" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "inventorySessions_store_fk" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE,
  CONSTRAINT "inventorySessions_zone_fk" FOREIGN KEY ("storageZoneId") REFERENCES "storageZone"("id") ON DELETE CASCADE,
  CONSTRAINT "inventorySessions_requestedBy_fk" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE SET NULL,
  CONSTRAINT "inventorySessions_closedBy_fk" FOREIGN KEY ("closedById") REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS "inventorySessionItems" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "inventoryLotId" TEXT,
  "batchNumber" TEXT,
  "expiryDate" TIMESTAMPTZ,
  "manufacturedAt" TIMESTAMPTZ,
  "unitCost" DECIMAL(18, 4),
  "systemQuantity" DECIMAL(18, 4) NOT NULL DEFAULT 0,
  "physicalQuantity" DECIMAL(18, 4),
  "varianceQuantity" DECIMAL(18, 4),
  "note" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "inventorySessionItems_tenant_fk" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "inventorySessionItems_session_fk" FOREIGN KEY ("sessionId") REFERENCES "inventorySessions"("id") ON DELETE CASCADE,
  CONSTRAINT "inventorySessionItems_product_fk" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "inventorySessionApprovals" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "stepOrder" INTEGER NOT NULL,
  "approverRole" TEXT,
  "approverId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "decidedAt" TIMESTAMPTZ,
  "note" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "inventorySessionApprovals_status_check" CHECK ("status" IN ('PENDING', 'APPROVED', 'REJECTED')),
  CONSTRAINT "inventorySessionApprovals_tenant_fk" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "inventorySessionApprovals_session_fk" FOREIGN KEY ("sessionId") REFERENCES "inventorySessions"("id") ON DELETE CASCADE,
  CONSTRAINT "inventorySessionApprovals_approver_fk" FOREIGN KEY ("approverId") REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "inventorySessions_single_active_tenant"
ON "inventorySessions" ("tenantId")
WHERE "status" <> 'CLOSED';

CREATE INDEX IF NOT EXISTS "inventorySessions_store_idx"
ON "inventorySessions" ("storeId", "createdAt");

CREATE INDEX IF NOT EXISTS "inventorySessionItems_session_idx"
ON "inventorySessionItems" ("sessionId");

CREATE INDEX IF NOT EXISTS "inventorySessionItems_session_product_lot_idx"
ON "inventorySessionItems" ("sessionId", "productId", "expiryDate");

CREATE INDEX IF NOT EXISTS "inventorySessionApprovals_session_idx"
ON "inventorySessionApprovals" ("sessionId", "stepOrder");

CREATE TABLE IF NOT EXISTS "user_preferences" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL UNIQUE,
  "theme" TEXT,
  "primaryColor" TEXT,
  "secondaryColor" TEXT,
  "accentColor" TEXT,
  "printerMode" TEXT,
  "printerServiceUrl" TEXT,
  "printerName" TEXT,
  "autoPrintReceipt" BOOLEAN NOT NULL DEFAULT TRUE,
  "showSecondaryAmounts" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "user_preferences_tenant_idx"
ON "user_preferences" ("tenantId");

CREATE TABLE IF NOT EXISTS "documentApprovals" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "documentType" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "flowCode" TEXT,
  "stepOrder" INTEGER NOT NULL,
  "approverRole" TEXT,
  "approverId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "note" TEXT,
  "decidedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "documentApprovals_status_check" CHECK ("status" IN ('PENDING', 'APPROVED', 'REJECTED')),
  CONSTRAINT "documentApprovals_approver_fk" FOREIGN KEY ("approverId") REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "documentApprovals_tenant_document_idx"
ON "documentApprovals" ("tenantId", "documentType", "documentId");

CREATE UNIQUE INDEX IF NOT EXISTS "documentApprovals_document_step_key"
ON "documentApprovals" ("tenantId", "documentType", "documentId", "stepOrder");

CREATE TABLE IF NOT EXISTS "orderAuditLogs" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "orderId" TEXT NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
  "action" TEXT NOT NULL,
  "actorUserId" TEXT REFERENCES "users"("id") ON DELETE SET NULL,
  "reason" TEXT,
  "details" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "orderAuditLogs_order_created_idx"
ON "orderAuditLogs" ("orderId", "createdAt" DESC);

CREATE TABLE IF NOT EXISTS "supplierReturns" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "code" TEXT,
  "supplierId" TEXT NOT NULL,
  "storageZoneId" TEXT NOT NULL,
  "requestedById" TEXT,
  "approvedById" TEXT,
  "postedById" TEXT,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "note" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "approvedAt" TIMESTAMPTZ,
  "postedAt" TIMESTAMPTZ,
  CONSTRAINT "supplierReturns_status_check" CHECK ("status" IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'POSTED')),
  CONSTRAINT "supplierReturns_supplier_fk" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT,
  CONSTRAINT "supplierReturns_zone_fk" FOREIGN KEY ("storageZoneId") REFERENCES "storageZone"("id") ON DELETE RESTRICT,
  CONSTRAINT "supplierReturns_requestedBy_fk" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE SET NULL,
  CONSTRAINT "supplierReturns_approvedBy_fk" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL,
  CONSTRAINT "supplierReturns_postedBy_fk" FOREIGN KEY ("postedById") REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS "supplierReturnItems" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "supplierReturnId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "unitId" TEXT,
  "quantity" DECIMAL(12,4) NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "supplierReturnItems_return_fk" FOREIGN KEY ("supplierReturnId") REFERENCES "supplierReturns"("id") ON DELETE CASCADE,
  CONSTRAINT "supplierReturnItems_product_fk" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT,
  CONSTRAINT "supplierReturnItems_unit_fk" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "supplierReturns_tenant_idx"
ON "supplierReturns" ("tenantId", "createdAt");

CREATE INDEX IF NOT EXISTS "supplierReturnItems_return_idx"
ON "supplierReturnItems" ("supplierReturnId");

-- Performance indexes for hot list endpoints.
CREATE INDEX IF NOT EXISTS "products_tenant_kind_isActive_createdAt_idx"
ON "products" ("tenantId", "kind", "isActive", "createdAt");

CREATE INDEX IF NOT EXISTS "orders_tenant_status_createdAt_idx"
ON "orders" ("tenantId", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "orders_tenant_store_createdAt_idx"
ON "orders" ("tenantId", "storeId", "createdAt");

CREATE INDEX IF NOT EXISTS "payements_tenant_order_idx"
ON "payements" ("tenantId", "orderId");

CREATE INDEX IF NOT EXISTS "payements_tenant_status_paidAt_idx"
ON "payements" ("tenantId", "status", "paidAt");

CREATE INDEX IF NOT EXISTS "inventory_tenant_store_updatedAt_idx"
ON "inventory" ("tenantId", "storeId", "updatedAt");

CREATE INDEX IF NOT EXISTS "inventory_tenant_product_idx"
ON "inventory" ("tenantId", "productId");

CREATE INDEX IF NOT EXISTS "stockEntries_tenant_status_createdAt_idx"
ON "stockEntries" ("tenantId", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "stockEntries_tenant_store_createdAt_idx"
ON "stockEntries" ("tenantId", "storeId", "createdAt");

CREATE INDEX IF NOT EXISTS "inventoryMovements_tenant_createdAt_idx"
ON "inventoryMovements" ("tenantId", "createdAt");
