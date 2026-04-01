const prisma = require("../config/prisma");

const tableName = "user_preferences";

const ensureUserPreferenceTable = async () => {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "${tableName}" (
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
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "user_preferences_tenant_idx"
    ON "${tableName}" ("tenantId")
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "${tableName}"
    ADD COLUMN IF NOT EXISTS "primaryColor" TEXT
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "${tableName}"
    ADD COLUMN IF NOT EXISTS "secondaryColor" TEXT
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "${tableName}"
    ADD COLUMN IF NOT EXISTS "accentColor" TEXT
  `);
};

const defaultPreferences = {
  theme: null,
  primaryColor: "green",
  secondaryColor: "green",
  accentColor: "green",
  printerMode: "browser",
  printerServiceUrl: "",
  printerName: "",
  autoPrintReceipt: true,
  showSecondaryAmounts: true,
};

const mapPreferenceRow = (row) => ({
  ...defaultPreferences,
  ...(row || {}),
  autoPrintReceipt:
    row?.autoPrintReceipt === undefined
      ? defaultPreferences.autoPrintReceipt
      : Boolean(row.autoPrintReceipt),
  showSecondaryAmounts:
    row?.showSecondaryAmounts === undefined
      ? defaultPreferences.showSecondaryAmounts
      : Boolean(row.showSecondaryAmounts),
});

const getUserPreferences = async ({ tenantId, userId }) => {
  await ensureUserPreferenceTable();

  const [row] = await prisma.$queryRawUnsafe(
    `
      SELECT
        "tenantId",
        "userId",
        "theme",
        "primaryColor",
        "secondaryColor",
        "accentColor",
        "printerMode",
        "printerServiceUrl",
        "printerName",
        "autoPrintReceipt",
        "showSecondaryAmounts",
        "createdAt",
        "updatedAt"
      FROM "${tableName}"
      WHERE "tenantId" = $1
        AND "userId" = $2
      LIMIT 1
    `,
    tenantId,
    userId,
  );

  return mapPreferenceRow(row);
};

const upsertUserPreferences = async ({ tenantId, userId, preferences = {} }) => {
  await ensureUserPreferenceTable();

  const current = await getUserPreferences({ tenantId, userId });
  const next = {
    ...current,
    ...preferences,
  };

  const id = `${tenantId}:${userId}`;

  await prisma.$executeRawUnsafe(
    `
      INSERT INTO "${tableName}" (
        "id",
        "tenantId",
        "userId",
        "theme",
        "primaryColor",
        "secondaryColor",
        "accentColor",
        "printerMode",
        "printerServiceUrl",
        "printerName",
        "autoPrintReceipt",
        "showSecondaryAmounts",
        "updatedAt"
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,CURRENT_TIMESTAMP)
      ON CONFLICT ("userId")
      DO UPDATE SET
        "theme" = EXCLUDED."theme",
        "primaryColor" = EXCLUDED."primaryColor",
        "secondaryColor" = EXCLUDED."secondaryColor",
        "accentColor" = EXCLUDED."accentColor",
        "printerMode" = EXCLUDED."printerMode",
        "printerServiceUrl" = EXCLUDED."printerServiceUrl",
        "printerName" = EXCLUDED."printerName",
        "autoPrintReceipt" = EXCLUDED."autoPrintReceipt",
        "showSecondaryAmounts" = EXCLUDED."showSecondaryAmounts",
        "updatedAt" = CURRENT_TIMESTAMP
    `,
    id,
    tenantId,
    userId,
    next.theme || null,
    next.primaryColor || "green",
    next.secondaryColor || "green",
    next.accentColor || "green",
    next.printerMode || "browser",
    next.printerServiceUrl || null,
    next.printerName || null,
    Boolean(next.autoPrintReceipt),
    Boolean(next.showSecondaryAmounts),
  );

  return getUserPreferences({ tenantId, userId });
};

module.exports = {
  ensureUserPreferenceTable,
  getUserPreferences,
  upsertUserPreferences,
  defaultPreferences,
};
