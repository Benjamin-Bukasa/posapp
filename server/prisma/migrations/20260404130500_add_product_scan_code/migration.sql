ALTER TABLE "products"
ADD COLUMN IF NOT EXISTS "scanCode" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "products_tenantId_scanCode_key"
ON "products" ("tenantId", "scanCode");
