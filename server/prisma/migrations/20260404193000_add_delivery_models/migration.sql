ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'DRIVER';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DeliveryStatus') THEN
    CREATE TYPE "DeliveryStatus" AS ENUM (
      'PENDING',
      'ASSIGNED',
      'IN_TRANSIT',
      'ARRIVED',
      'DELIVERED',
      'CANCELED'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "deliveries" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "storeId" TEXT,
  "orderId" TEXT NOT NULL,
  "driverId" TEXT,
  "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "assignedAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "arrivedAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "canceledAt" TIMESTAMP(3),
  "canceledReason" TEXT,
  "customerName" TEXT,
  "customerPhone" TEXT,
  "deliveryAddress" TEXT,
  "customerLatitude" DECIMAL(10,7),
  "customerLongitude" DECIMAL(10,7),
  "lastDriverLatitude" DECIMAL(10,7),
  "lastDriverLongitude" DECIMAL(10,7),
  "lastDriverAccuracy" DECIMAL(10,2),
  "lastLocationAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "driver_locations" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "driverId" TEXT NOT NULL,
  "deliveryId" TEXT,
  "latitude" DECIMAL(10,7) NOT NULL,
  "longitude" DECIMAL(10,7) NOT NULL,
  "accuracy" DECIMAL(10,2),
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "driver_locations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "deliveries_orderId_key" ON "deliveries"("orderId");
CREATE INDEX IF NOT EXISTS "deliveries_tenantId_idx" ON "deliveries"("tenantId");
CREATE INDEX IF NOT EXISTS "deliveries_driverId_status_idx" ON "deliveries"("driverId", "status");
CREATE INDEX IF NOT EXISTS "deliveries_storeId_status_idx" ON "deliveries"("storeId", "status");
CREATE INDEX IF NOT EXISTS "driver_locations_tenantId_idx" ON "driver_locations"("tenantId");
CREATE INDEX IF NOT EXISTS "driver_locations_driverId_recordedAt_idx" ON "driver_locations"("driverId", "recordedAt");
CREATE INDEX IF NOT EXISTS "driver_locations_deliveryId_recordedAt_idx" ON "driver_locations"("deliveryId", "recordedAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'deliveries_tenantId_fkey'
  ) THEN
    ALTER TABLE "deliveries"
      ADD CONSTRAINT "deliveries_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'deliveries_storeId_fkey'
  ) THEN
    ALTER TABLE "deliveries"
      ADD CONSTRAINT "deliveries_storeId_fkey"
      FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'deliveries_orderId_fkey'
  ) THEN
    ALTER TABLE "deliveries"
      ADD CONSTRAINT "deliveries_orderId_fkey"
      FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'deliveries_driverId_fkey'
  ) THEN
    ALTER TABLE "deliveries"
      ADD CONSTRAINT "deliveries_driverId_fkey"
      FOREIGN KEY ("driverId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'driver_locations_tenantId_fkey'
  ) THEN
    ALTER TABLE "driver_locations"
      ADD CONSTRAINT "driver_locations_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'driver_locations_driverId_fkey'
  ) THEN
    ALTER TABLE "driver_locations"
      ADD CONSTRAINT "driver_locations_driverId_fkey"
      FOREIGN KEY ("driverId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'driver_locations_deliveryId_fkey'
  ) THEN
    ALTER TABLE "driver_locations"
      ADD CONSTRAINT "driver_locations_deliveryId_fkey"
      FOREIGN KEY ("deliveryId") REFERENCES "deliveries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
