const prisma = require("../config/prisma");

const tableName = "receipt_settings";

const defaultReceiptSettings = {
  paperFormat: "80mm",
  logoUrl: "",
  showLogo: false,
  logoMonochrome: true,
  headerText: "",
  footerText: "Merci pour votre achat",
  showHeaderText: true,
  showFooterText: true,
  showBusinessName: true,
  showStoreName: true,
  showTicketNumber: true,
  showDateTime: true,
  showCashier: true,
  showCustomer: true,
  showItems: true,
  showSubtotal: true,
  showTotal: true,
  showPaymentMethod: true,
  showAmountReceived: true,
  showOriginalAmount: true,
  showChange: true,
  showLoyaltyPoints: true,
  closurePaperFormat: "80mm",
  closureHeaderText: "Rapport de cloture",
  closureFooterText: "Fin de cloture",
  showClosureHeaderText: true,
  showClosureFooterText: true,
  showClosureBusinessName: true,
  showClosureStoreName: true,
  showClosureCashier: true,
  showClosureDateTime: true,
  showClosureSummary: true,
  showClosureSalesTable: true,
  showClosureCanceledTable: true,
  showClosureGrandTotal: true,
};

const mapReceiptSettingsRow = (row) => ({
  ...defaultReceiptSettings,
  ...(row || {}),
  showLogo:
    row?.showLogo === undefined ? defaultReceiptSettings.showLogo : Boolean(row.showLogo),
  logoMonochrome:
    row?.logoMonochrome === undefined
      ? defaultReceiptSettings.logoMonochrome
      : Boolean(row.logoMonochrome),
  showHeaderText:
    row?.showHeaderText === undefined
      ? defaultReceiptSettings.showHeaderText
      : Boolean(row.showHeaderText),
  showFooterText:
    row?.showFooterText === undefined
      ? defaultReceiptSettings.showFooterText
      : Boolean(row.showFooterText),
  showBusinessName:
    row?.showBusinessName === undefined
      ? defaultReceiptSettings.showBusinessName
      : Boolean(row.showBusinessName),
  showStoreName:
    row?.showStoreName === undefined
      ? defaultReceiptSettings.showStoreName
      : Boolean(row.showStoreName),
  showTicketNumber:
    row?.showTicketNumber === undefined
      ? defaultReceiptSettings.showTicketNumber
      : Boolean(row.showTicketNumber),
  showDateTime:
    row?.showDateTime === undefined
      ? defaultReceiptSettings.showDateTime
      : Boolean(row.showDateTime),
  showCashier:
    row?.showCashier === undefined ? defaultReceiptSettings.showCashier : Boolean(row.showCashier),
  showCustomer:
    row?.showCustomer === undefined
      ? defaultReceiptSettings.showCustomer
      : Boolean(row.showCustomer),
  showItems:
    row?.showItems === undefined ? defaultReceiptSettings.showItems : Boolean(row.showItems),
  showSubtotal:
    row?.showSubtotal === undefined
      ? defaultReceiptSettings.showSubtotal
      : Boolean(row.showSubtotal),
  showTotal:
    row?.showTotal === undefined ? defaultReceiptSettings.showTotal : Boolean(row.showTotal),
  showPaymentMethod:
    row?.showPaymentMethod === undefined
      ? defaultReceiptSettings.showPaymentMethod
      : Boolean(row.showPaymentMethod),
  showAmountReceived:
    row?.showAmountReceived === undefined
      ? defaultReceiptSettings.showAmountReceived
      : Boolean(row.showAmountReceived),
  showOriginalAmount:
    row?.showOriginalAmount === undefined
      ? defaultReceiptSettings.showOriginalAmount
      : Boolean(row.showOriginalAmount),
  showChange:
    row?.showChange === undefined ? defaultReceiptSettings.showChange : Boolean(row.showChange),
  showLoyaltyPoints:
    row?.showLoyaltyPoints === undefined
      ? defaultReceiptSettings.showLoyaltyPoints
      : Boolean(row.showLoyaltyPoints),
  closurePaperFormat:
    row?.closurePaperFormat || defaultReceiptSettings.closurePaperFormat,
  closureHeaderText:
    row?.closureHeaderText === undefined
      ? defaultReceiptSettings.closureHeaderText
      : row.closureHeaderText || "",
  closureFooterText:
    row?.closureFooterText === undefined
      ? defaultReceiptSettings.closureFooterText
      : row.closureFooterText || "",
  showClosureHeaderText:
    row?.showClosureHeaderText === undefined
      ? defaultReceiptSettings.showClosureHeaderText
      : Boolean(row.showClosureHeaderText),
  showClosureFooterText:
    row?.showClosureFooterText === undefined
      ? defaultReceiptSettings.showClosureFooterText
      : Boolean(row.showClosureFooterText),
  showClosureBusinessName:
    row?.showClosureBusinessName === undefined
      ? defaultReceiptSettings.showClosureBusinessName
      : Boolean(row.showClosureBusinessName),
  showClosureStoreName:
    row?.showClosureStoreName === undefined
      ? defaultReceiptSettings.showClosureStoreName
      : Boolean(row.showClosureStoreName),
  showClosureCashier:
    row?.showClosureCashier === undefined
      ? defaultReceiptSettings.showClosureCashier
      : Boolean(row.showClosureCashier),
  showClosureDateTime:
    row?.showClosureDateTime === undefined
      ? defaultReceiptSettings.showClosureDateTime
      : Boolean(row.showClosureDateTime),
  showClosureSummary:
    row?.showClosureSummary === undefined
      ? defaultReceiptSettings.showClosureSummary
      : Boolean(row.showClosureSummary),
  showClosureSalesTable:
    row?.showClosureSalesTable === undefined
      ? defaultReceiptSettings.showClosureSalesTable
      : Boolean(row.showClosureSalesTable),
  showClosureCanceledTable:
    row?.showClosureCanceledTable === undefined
      ? defaultReceiptSettings.showClosureCanceledTable
      : Boolean(row.showClosureCanceledTable),
  showClosureGrandTotal:
    row?.showClosureGrandTotal === undefined
      ? defaultReceiptSettings.showClosureGrandTotal
      : Boolean(row.showClosureGrandTotal),
});

const ensureReceiptSettingsTable = async () => {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "${tableName}" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL UNIQUE,
      "paperFormat" TEXT NOT NULL DEFAULT '80mm',
      "logoUrl" TEXT,
      "showLogo" BOOLEAN NOT NULL DEFAULT FALSE,
      "logoMonochrome" BOOLEAN NOT NULL DEFAULT TRUE,
      "headerText" TEXT,
      "footerText" TEXT,
      "showHeaderText" BOOLEAN NOT NULL DEFAULT TRUE,
      "showFooterText" BOOLEAN NOT NULL DEFAULT TRUE,
      "showBusinessName" BOOLEAN NOT NULL DEFAULT TRUE,
      "showStoreName" BOOLEAN NOT NULL DEFAULT TRUE,
      "showTicketNumber" BOOLEAN NOT NULL DEFAULT TRUE,
      "showDateTime" BOOLEAN NOT NULL DEFAULT TRUE,
      "showCashier" BOOLEAN NOT NULL DEFAULT TRUE,
      "showCustomer" BOOLEAN NOT NULL DEFAULT TRUE,
      "showItems" BOOLEAN NOT NULL DEFAULT TRUE,
      "showSubtotal" BOOLEAN NOT NULL DEFAULT TRUE,
      "showTotal" BOOLEAN NOT NULL DEFAULT TRUE,
      "showPaymentMethod" BOOLEAN NOT NULL DEFAULT TRUE,
      "showAmountReceived" BOOLEAN NOT NULL DEFAULT TRUE,
      "showOriginalAmount" BOOLEAN NOT NULL DEFAULT TRUE,
      "showChange" BOOLEAN NOT NULL DEFAULT TRUE,
      "showLoyaltyPoints" BOOLEAN NOT NULL DEFAULT TRUE,
      "closurePaperFormat" TEXT NOT NULL DEFAULT '80mm',
      "closureHeaderText" TEXT,
      "closureFooterText" TEXT,
      "showClosureHeaderText" BOOLEAN NOT NULL DEFAULT TRUE,
      "showClosureFooterText" BOOLEAN NOT NULL DEFAULT TRUE,
      "showClosureBusinessName" BOOLEAN NOT NULL DEFAULT TRUE,
      "showClosureStoreName" BOOLEAN NOT NULL DEFAULT TRUE,
      "showClosureCashier" BOOLEAN NOT NULL DEFAULT TRUE,
      "showClosureDateTime" BOOLEAN NOT NULL DEFAULT TRUE,
      "showClosureSummary" BOOLEAN NOT NULL DEFAULT TRUE,
      "showClosureSalesTable" BOOLEAN NOT NULL DEFAULT TRUE,
      "showClosureCanceledTable" BOOLEAN NOT NULL DEFAULT TRUE,
      "showClosureGrandTotal" BOOLEAN NOT NULL DEFAULT TRUE,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "receipt_settings_paper_format_check"
        CHECK ("paperFormat" IN ('58mm', '80mm'))
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "receipt_settings_tenant_idx"
    ON "${tableName}" ("tenantId")
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "${tableName}"
    ADD COLUMN IF NOT EXISTS "closurePaperFormat" TEXT NOT NULL DEFAULT '80mm'
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "${tableName}"
    ADD COLUMN IF NOT EXISTS "closureHeaderText" TEXT
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "${tableName}"
    ADD COLUMN IF NOT EXISTS "closureFooterText" TEXT
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "${tableName}"
    ADD COLUMN IF NOT EXISTS "showClosureHeaderText" BOOLEAN NOT NULL DEFAULT TRUE
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "${tableName}"
    ADD COLUMN IF NOT EXISTS "showClosureFooterText" BOOLEAN NOT NULL DEFAULT TRUE
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "${tableName}"
    ADD COLUMN IF NOT EXISTS "showClosureBusinessName" BOOLEAN NOT NULL DEFAULT TRUE
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "${tableName}"
    ADD COLUMN IF NOT EXISTS "showClosureStoreName" BOOLEAN NOT NULL DEFAULT TRUE
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "${tableName}"
    ADD COLUMN IF NOT EXISTS "showClosureCashier" BOOLEAN NOT NULL DEFAULT TRUE
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "${tableName}"
    ADD COLUMN IF NOT EXISTS "showClosureDateTime" BOOLEAN NOT NULL DEFAULT TRUE
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "${tableName}"
    ADD COLUMN IF NOT EXISTS "showClosureSummary" BOOLEAN NOT NULL DEFAULT TRUE
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "${tableName}"
    ADD COLUMN IF NOT EXISTS "showClosureSalesTable" BOOLEAN NOT NULL DEFAULT TRUE
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "${tableName}"
    ADD COLUMN IF NOT EXISTS "showClosureCanceledTable" BOOLEAN NOT NULL DEFAULT TRUE
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "${tableName}"
    ADD COLUMN IF NOT EXISTS "showClosureGrandTotal" BOOLEAN NOT NULL DEFAULT TRUE
  `);
};

const getReceiptSettings = async ({ tenantId }) => {
  await ensureReceiptSettingsTable();

  const [row] = await prisma.$queryRawUnsafe(
    `
      SELECT
        "tenantId",
        "paperFormat",
        "logoUrl",
        "showLogo",
        "logoMonochrome",
        "headerText",
        "footerText",
        "showHeaderText",
        "showFooterText",
        "showBusinessName",
        "showStoreName",
        "showTicketNumber",
        "showDateTime",
        "showCashier",
        "showCustomer",
        "showItems",
        "showSubtotal",
        "showTotal",
        "showPaymentMethod",
        "showAmountReceived",
        "showOriginalAmount",
        "showChange",
        "showLoyaltyPoints",
        "closurePaperFormat",
        "closureHeaderText",
        "closureFooterText",
        "showClosureHeaderText",
        "showClosureFooterText",
        "showClosureBusinessName",
        "showClosureStoreName",
        "showClosureCashier",
        "showClosureDateTime",
        "showClosureSummary",
        "showClosureSalesTable",
        "showClosureCanceledTable",
        "showClosureGrandTotal",
        "createdAt",
        "updatedAt"
      FROM "${tableName}"
      WHERE "tenantId" = $1
      LIMIT 1
    `,
    tenantId,
  );

  return mapReceiptSettingsRow(row);
};

const upsertReceiptSettings = async ({ tenantId, settings = {} }) => {
  await ensureReceiptSettingsTable();
  const current = await getReceiptSettings({ tenantId });
  const next = {
    ...current,
    ...settings,
  };

  await prisma.$executeRawUnsafe(
    `
      INSERT INTO "${tableName}" (
        "id",
        "tenantId",
        "paperFormat",
        "logoUrl",
        "showLogo",
        "logoMonochrome",
        "headerText",
        "footerText",
        "showHeaderText",
        "showFooterText",
        "showBusinessName",
        "showStoreName",
        "showTicketNumber",
        "showDateTime",
        "showCashier",
        "showCustomer",
        "showItems",
        "showSubtotal",
        "showTotal",
        "showPaymentMethod",
        "showAmountReceived",
        "showOriginalAmount",
        "showChange",
        "showLoyaltyPoints",
        "closurePaperFormat",
        "closureHeaderText",
        "closureFooterText",
        "showClosureHeaderText",
        "showClosureFooterText",
        "showClosureBusinessName",
        "showClosureStoreName",
        "showClosureCashier",
        "showClosureDateTime",
        "showClosureSummary",
        "showClosureSalesTable",
        "showClosureCanceledTable",
        "showClosureGrandTotal",
        "updatedAt"
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,CURRENT_TIMESTAMP
      )
      ON CONFLICT ("tenantId")
      DO UPDATE SET
        "paperFormat" = EXCLUDED."paperFormat",
        "logoUrl" = EXCLUDED."logoUrl",
        "showLogo" = EXCLUDED."showLogo",
        "logoMonochrome" = EXCLUDED."logoMonochrome",
        "headerText" = EXCLUDED."headerText",
        "footerText" = EXCLUDED."footerText",
        "showHeaderText" = EXCLUDED."showHeaderText",
        "showFooterText" = EXCLUDED."showFooterText",
        "showBusinessName" = EXCLUDED."showBusinessName",
        "showStoreName" = EXCLUDED."showStoreName",
        "showTicketNumber" = EXCLUDED."showTicketNumber",
        "showDateTime" = EXCLUDED."showDateTime",
        "showCashier" = EXCLUDED."showCashier",
        "showCustomer" = EXCLUDED."showCustomer",
        "showItems" = EXCLUDED."showItems",
        "showSubtotal" = EXCLUDED."showSubtotal",
        "showTotal" = EXCLUDED."showTotal",
        "showPaymentMethod" = EXCLUDED."showPaymentMethod",
        "showAmountReceived" = EXCLUDED."showAmountReceived",
        "showOriginalAmount" = EXCLUDED."showOriginalAmount",
        "showChange" = EXCLUDED."showChange",
        "showLoyaltyPoints" = EXCLUDED."showLoyaltyPoints",
        "closurePaperFormat" = EXCLUDED."closurePaperFormat",
        "closureHeaderText" = EXCLUDED."closureHeaderText",
        "closureFooterText" = EXCLUDED."closureFooterText",
        "showClosureHeaderText" = EXCLUDED."showClosureHeaderText",
        "showClosureFooterText" = EXCLUDED."showClosureFooterText",
        "showClosureBusinessName" = EXCLUDED."showClosureBusinessName",
        "showClosureStoreName" = EXCLUDED."showClosureStoreName",
        "showClosureCashier" = EXCLUDED."showClosureCashier",
        "showClosureDateTime" = EXCLUDED."showClosureDateTime",
        "showClosureSummary" = EXCLUDED."showClosureSummary",
        "showClosureSalesTable" = EXCLUDED."showClosureSalesTable",
        "showClosureCanceledTable" = EXCLUDED."showClosureCanceledTable",
        "showClosureGrandTotal" = EXCLUDED."showClosureGrandTotal",
        "updatedAt" = CURRENT_TIMESTAMP
    `,
    `${tenantId}:receipt`,
    tenantId,
    next.paperFormat || "80mm",
    next.logoUrl || null,
    Boolean(next.showLogo),
    Boolean(next.logoMonochrome),
    next.headerText || null,
    next.footerText || null,
    Boolean(next.showHeaderText),
    Boolean(next.showFooterText),
    Boolean(next.showBusinessName),
    Boolean(next.showStoreName),
    Boolean(next.showTicketNumber),
    Boolean(next.showDateTime),
    Boolean(next.showCashier),
    Boolean(next.showCustomer),
    Boolean(next.showItems),
    Boolean(next.showSubtotal),
    Boolean(next.showTotal),
    Boolean(next.showPaymentMethod),
    Boolean(next.showAmountReceived),
    Boolean(next.showOriginalAmount),
    Boolean(next.showChange),
    Boolean(next.showLoyaltyPoints),
    next.closurePaperFormat || "80mm",
    next.closureHeaderText || null,
    next.closureFooterText || null,
    Boolean(next.showClosureHeaderText),
    Boolean(next.showClosureFooterText),
    Boolean(next.showClosureBusinessName),
    Boolean(next.showClosureStoreName),
    Boolean(next.showClosureCashier),
    Boolean(next.showClosureDateTime),
    Boolean(next.showClosureSummary),
    Boolean(next.showClosureSalesTable),
    Boolean(next.showClosureCanceledTable),
    Boolean(next.showClosureGrandTotal),
  );

  return getReceiptSettings({ tenantId });
};

module.exports = {
  ensureReceiptSettingsTable,
  getReceiptSettings,
  upsertReceiptSettings,
  defaultReceiptSettings,
};
