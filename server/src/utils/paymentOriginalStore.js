const { DEFAULT_PRIMARY_CURRENCY, normalizeCurrencyCode } = require("./currencySettings");

let paymentOriginalColumnsEnsured = false;

const ensurePaymentOriginalColumns = async (prisma) => {
  if (paymentOriginalColumnsEnsured) {
    return;
  }

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "payements"
    ADD COLUMN IF NOT EXISTS "originalAmount" DECIMAL(18, 2),
    ADD COLUMN IF NOT EXISTS "originalCurrencyCode" TEXT
  `);

  paymentOriginalColumnsEnsured = true;
};

const getPaymentOriginalMap = async (prisma, ids = []) => {
  const uniqueIds = [...new Set((ids || []).filter(Boolean))];
  if (!uniqueIds.length) {
    return new Map();
  }

  await ensurePaymentOriginalColumns(prisma);

  const placeholders = uniqueIds.map((_, index) => `$${index + 1}`).join(", ");
  const rows = await prisma.$queryRawUnsafe(
    `SELECT "id", "originalAmount", "originalCurrencyCode" FROM "payements" WHERE "id" IN (${placeholders})`,
    ...uniqueIds,
  );

  return new Map(
    rows.map((row) => [
      row.id,
      {
        originalAmount:
          row.originalAmount == null ? null : Number(row.originalAmount),
        originalCurrencyCode: row.originalCurrencyCode
          ? normalizeCurrencyCode(row.originalCurrencyCode, DEFAULT_PRIMARY_CURRENCY)
          : null,
      },
    ]),
  );
};

const setPaymentOriginal = async (
  prisma,
  paymentId,
  { originalAmount = null, originalCurrencyCode = null } = {},
) => {
  if (!paymentId) return;

  await ensurePaymentOriginalColumns(prisma);

  const normalizedAmount =
    originalAmount === null || originalAmount === undefined || Number.isNaN(Number(originalAmount))
      ? null
      : Number(originalAmount);
  const normalizedCurrencyCode = originalCurrencyCode
    ? normalizeCurrencyCode(originalCurrencyCode, DEFAULT_PRIMARY_CURRENCY)
    : null;

  await prisma.$executeRawUnsafe(
    `UPDATE "payements"
     SET "originalAmount" = $1, "originalCurrencyCode" = $2
     WHERE "id" = $3`,
    normalizedAmount,
    normalizedCurrencyCode,
    paymentId,
  );
};

const attachPaymentOriginalDetails = (records = [], originalMap) =>
  (records || []).map((record) => {
    if (!record) return record;

    const original = originalMap?.get(record.id);
    return {
      ...record,
      originalAmount:
        original?.originalAmount == null
          ? Number(record.amount || 0)
          : Number(original.originalAmount),
      originalCurrencyCode:
        original?.originalCurrencyCode || record.currencyCode || DEFAULT_PRIMARY_CURRENCY,
    };
  });

module.exports = {
  ensurePaymentOriginalColumns,
  getPaymentOriginalMap,
  setPaymentOriginal,
  attachPaymentOriginalDetails,
};
