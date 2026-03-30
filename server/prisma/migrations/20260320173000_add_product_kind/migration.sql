CREATE TYPE "ProductKind" AS ENUM ('ARTICLE', 'COMPONENT');

ALTER TABLE "products"
ADD COLUMN "kind" "ProductKind" NOT NULL DEFAULT 'ARTICLE';

UPDATE "products"
SET "kind" = 'COMPONENT'
WHERE "id" IN (
  SELECT DISTINCT "componentProductId"
  FROM "productComponents"
  WHERE "componentProductId" IS NOT NULL
);

CREATE INDEX "products_tenantId_kind_idx" ON "products"("tenantId", "kind");
