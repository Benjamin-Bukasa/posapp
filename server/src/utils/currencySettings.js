const DEFAULT_PRIMARY_CURRENCY = "USD";

const DEFAULT_CURRENCY_CATALOG = {
  USD: { name: "Dollar americain", symbol: "$" },
  CDF: { name: "Franc congolais", symbol: "FC" },
  EUR: { name: "Euro", symbol: "EUR" },
};

let ensureCurrencyStoragePromise = null;

const normalizeCurrencyCode = (value, fallback = DEFAULT_PRIMARY_CURRENCY) => {
  const code = String(value || fallback)
    .trim()
    .toUpperCase();

  if (/^[A-Z]{3}$/.test(code)) {
    return code;
  }

  return fallback;
};

const parseExchangeRate = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
};

const getDefaultCurrencyMeta = (code) => {
  const normalizedCode = normalizeCurrencyCode(code, "");
  return DEFAULT_CURRENCY_CATALOG[normalizedCode] || { name: normalizedCode, symbol: null };
};

const mapCurrencyRow = (row = {}) => ({
  id: row.id,
  code: normalizeCurrencyCode(row.code, DEFAULT_PRIMARY_CURRENCY),
  name: String(row.name || getDefaultCurrencyMeta(row.code).name || "").trim(),
  symbol: row.symbol ? String(row.symbol).trim() : getDefaultCurrencyMeta(row.code).symbol,
  isCurrent: Boolean(row.isCurrent),
  isSecondary: Boolean(row.isSecondary),
  isActive: row.isActive === undefined ? true : Boolean(row.isActive),
  createdAt: row.createdAt || null,
  updatedAt: row.updatedAt || null,
});

const mapConversionRow = (row = {}) => ({
  id: row.id,
  fromCurrencyCode: normalizeCurrencyCode(row.fromCurrencyCode, DEFAULT_PRIMARY_CURRENCY),
  toCurrencyCode: normalizeCurrencyCode(row.toCurrencyCode, DEFAULT_PRIMARY_CURRENCY),
  rate: parseExchangeRate(row.rate),
  createdAt: row.createdAt || null,
  updatedAt: row.updatedAt || null,
});

const ensureTenantCurrencyColumns = async (prisma) => {
  if (!ensureCurrencyStoragePromise) {
    ensureCurrencyStoragePromise = (async () => {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "tenants"
        ADD COLUMN IF NOT EXISTS "primaryCurrencyCode" TEXT NOT NULL DEFAULT 'USD',
        ADD COLUMN IF NOT EXISTS "secondaryCurrencyCode" TEXT,
        ADD COLUMN IF NOT EXISTS "exchangeRate" DECIMAL(18, 6)
      `);

      await prisma.$executeRawUnsafe(`
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
        )
      `);

      await prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "tenantCurrencies_tenantId_code_key"
        ON "tenantCurrencies" ("tenantId", "code")
      `);

      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "tenantCurrencyConversions" (
          "id" TEXT PRIMARY KEY,
          "tenantId" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
          "fromCurrencyCode" TEXT NOT NULL,
          "toCurrencyCode" TEXT NOT NULL,
          "rate" DECIMAL(18, 6) NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "tenantCurrencyConversions_tenant_pair_key"
        ON "tenantCurrencyConversions" ("tenantId", "fromCurrencyCode", "toCurrencyCode")
      `);
    })().catch((error) => {
      ensureCurrencyStoragePromise = null;
      throw error;
    });
  }

  return ensureCurrencyStoragePromise;
};

const buildConversionGraph = (conversions = []) => {
  const graph = new Map();

  const addEdge = (fromCurrencyCode, toCurrencyCode, rate) => {
    if (!graph.has(fromCurrencyCode)) {
      graph.set(fromCurrencyCode, []);
    }

    graph.get(fromCurrencyCode).push({ toCurrencyCode, rate });
  };

  conversions.forEach((conversion) => {
    const fromCurrencyCode = normalizeCurrencyCode(
      conversion.fromCurrencyCode,
      DEFAULT_PRIMARY_CURRENCY,
    );
    const toCurrencyCode = normalizeCurrencyCode(
      conversion.toCurrencyCode,
      DEFAULT_PRIMARY_CURRENCY,
    );
    const rate = parseExchangeRate(conversion.rate);

    if (!rate || fromCurrencyCode === toCurrencyCode) {
      return;
    }

    addEdge(fromCurrencyCode, toCurrencyCode, rate);
    addEdge(toCurrencyCode, fromCurrencyCode, 1 / rate);
  });

  return graph;
};

const findConversionRate = (conversions = [], fromCurrencyCode, toCurrencyCode) => {
  const fromCode = normalizeCurrencyCode(fromCurrencyCode, DEFAULT_PRIMARY_CURRENCY);
  const toCode = normalizeCurrencyCode(toCurrencyCode, DEFAULT_PRIMARY_CURRENCY);

  if (fromCode === toCode) {
    return 1;
  }

  const graph = buildConversionGraph(conversions);
  const queue = [{ code: fromCode, factor: 1 }];
  const visited = new Set([fromCode]);

  while (queue.length) {
    const current = queue.shift();
    const edges = graph.get(current.code) || [];

    for (const edge of edges) {
      const nextFactor = current.factor * edge.rate;
      if (edge.toCurrencyCode === toCode) {
        return nextFactor;
      }

      if (!visited.has(edge.toCurrencyCode)) {
        visited.add(edge.toCurrencyCode);
        queue.push({ code: edge.toCurrencyCode, factor: nextFactor });
      }
    }
  }

  return null;
};

const loadTenantCurrencyState = async (prisma, tenantId) => {
  await ensureTenantCurrencyColumns(prisma);

  const tenantRows = await prisma.$queryRaw`
    SELECT
      "primaryCurrencyCode",
      "secondaryCurrencyCode",
      "exchangeRate"
    FROM "tenants"
    WHERE "id" = ${tenantId}
    LIMIT 1
  `;

  const currencyRows = await prisma.$queryRaw`
    SELECT
      "id",
      "code",
      "name",
      "symbol",
      "isCurrent",
      "isSecondary",
      "isActive",
      "createdAt",
      "updatedAt"
    FROM "tenantCurrencies"
    WHERE "tenantId" = ${tenantId}
    ORDER BY "isCurrent" DESC, "isSecondary" DESC, "code" ASC
  `;

  const conversionRows = await prisma.$queryRaw`
    SELECT
      "id",
      "fromCurrencyCode",
      "toCurrencyCode",
      "rate",
      "createdAt",
      "updatedAt"
    FROM "tenantCurrencyConversions"
    WHERE "tenantId" = ${tenantId}
    ORDER BY "fromCurrencyCode" ASC, "toCurrencyCode" ASC
  `;

  return {
    tenantExists: Boolean(tenantRows[0]),
    tenant: tenantRows[0] || {},
    currencies: currencyRows.map(mapCurrencyRow),
    conversions: conversionRows.map(mapConversionRow),
  };
};

const bootstrapTenantCurrencyCatalog = async (prisma, tenantId) => {
  const state = await loadTenantCurrencyState(prisma, tenantId);
  if (!state.tenantExists) {
    return;
  }
  const currentCount = state.currencies.length;

  if (!currentCount) {
    const primaryCurrencyCode = normalizeCurrencyCode(
      state.tenant.primaryCurrencyCode,
      DEFAULT_PRIMARY_CURRENCY,
    );
    const secondaryCurrencyCode = state.tenant.secondaryCurrencyCode
      ? normalizeCurrencyCode(state.tenant.secondaryCurrencyCode, "")
      : "";
    const exchangeRate = parseExchangeRate(state.tenant.exchangeRate);
    const primaryMeta = getDefaultCurrencyMeta(primaryCurrencyCode);

    await prisma.$executeRaw`
      INSERT INTO "tenantCurrencies" (
        "id",
        "tenantId",
        "code",
        "name",
        "symbol",
        "isCurrent",
        "isSecondary",
        "isActive",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        ${`cur_${tenantId}_${primaryCurrencyCode}`},
        ${tenantId},
        ${primaryCurrencyCode},
        ${primaryMeta.name},
        ${primaryMeta.symbol},
        ${true},
        ${false},
        ${true},
        NOW(),
        NOW()
      )
      ON CONFLICT ("tenantId", "code") DO NOTHING
    `;

    if (secondaryCurrencyCode && secondaryCurrencyCode !== primaryCurrencyCode) {
      const secondaryMeta = getDefaultCurrencyMeta(secondaryCurrencyCode);
      await prisma.$executeRaw`
        INSERT INTO "tenantCurrencies" (
          "id",
          "tenantId",
          "code",
          "name",
          "symbol",
          "isCurrent",
          "isSecondary",
          "isActive",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${`cur_${tenantId}_${secondaryCurrencyCode}`},
          ${tenantId},
          ${secondaryCurrencyCode},
          ${secondaryMeta.name},
          ${secondaryMeta.symbol},
          ${false},
          ${true},
          ${true},
          NOW(),
          NOW()
        )
        ON CONFLICT ("tenantId", "code") DO NOTHING
      `;

      if (exchangeRate) {
        await prisma.$executeRaw`
          INSERT INTO "tenantCurrencyConversions" (
            "id",
            "tenantId",
            "fromCurrencyCode",
            "toCurrencyCode",
            "rate",
            "createdAt",
            "updatedAt"
          )
          VALUES (
            ${`conv_${tenantId}_${primaryCurrencyCode}_${secondaryCurrencyCode}`},
            ${tenantId},
            ${primaryCurrencyCode},
            ${secondaryCurrencyCode},
            ${exchangeRate},
            NOW(),
            NOW()
          )
          ON CONFLICT ("tenantId", "fromCurrencyCode", "toCurrencyCode")
          DO NOTHING
        `;
      }
    }

    return;
  }

  const normalizedPrimary = normalizeCurrencyCode(
    state.tenant.primaryCurrencyCode,
    DEFAULT_PRIMARY_CURRENCY,
  );
  const existingCodes = new Set(state.currencies.map((currency) => currency.code));

  if (!existingCodes.has(normalizedPrimary)) {
    const primaryMeta = getDefaultCurrencyMeta(normalizedPrimary);
    await prisma.$executeRaw`
      INSERT INTO "tenantCurrencies" (
        "id",
        "tenantId",
        "code",
        "name",
        "symbol",
        "isCurrent",
        "isSecondary",
        "isActive",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        ${`cur_${tenantId}_${normalizedPrimary}`},
        ${tenantId},
        ${normalizedPrimary},
        ${primaryMeta.name},
        ${primaryMeta.symbol},
        ${!state.currencies.some((currency) => currency.isCurrent)},
        ${false},
        ${true},
        NOW(),
        NOW()
      )
      ON CONFLICT ("tenantId", "code") DO NOTHING
    `;
  }

  const normalizedSecondary = state.tenant.secondaryCurrencyCode
    ? normalizeCurrencyCode(state.tenant.secondaryCurrencyCode, "")
    : "";

  if (
    normalizedSecondary &&
    normalizedSecondary !== normalizedPrimary &&
    !existingCodes.has(normalizedSecondary)
  ) {
    const secondaryMeta = getDefaultCurrencyMeta(normalizedSecondary);
    await prisma.$executeRaw`
      INSERT INTO "tenantCurrencies" (
        "id",
        "tenantId",
        "code",
        "name",
        "symbol",
        "isCurrent",
        "isSecondary",
        "isActive",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        ${`cur_${tenantId}_${normalizedSecondary}`},
        ${tenantId},
        ${normalizedSecondary},
        ${secondaryMeta.name},
        ${secondaryMeta.symbol},
        ${false},
        ${true},
        ${true},
        NOW(),
        NOW()
      )
      ON CONFLICT ("tenantId", "code") DO NOTHING
    `;
  }

  if (!state.currencies.some((currency) => currency.isCurrent)) {
    const currentCurrency =
      state.currencies.find((currency) => currency.code === normalizedPrimary) ||
      state.currencies.find((currency) => currency.isActive) ||
      state.currencies[0] ||
      null;

    if (currentCurrency) {
      await prisma.$executeRaw`
        UPDATE "tenantCurrencies"
        SET
          "isCurrent" = CASE WHEN "id" = ${currentCurrency.id} THEN true ELSE false END,
          "updatedAt" = NOW()
        WHERE "tenantId" = ${tenantId}
      `;
    }
  }
};

const syncTenantCurrencyColumns = async (prisma, tenantId) => {
  await bootstrapTenantCurrencyCatalog(prisma, tenantId);
  const state = await loadTenantCurrencyState(prisma, tenantId);

  if (!state.tenantExists) {
    return;
  }

  let currentCurrency =
    state.currencies.find((currency) => currency.isCurrent && currency.isActive) ||
    state.currencies.find((currency) => currency.isCurrent) ||
    state.currencies.find((currency) => currency.isActive) ||
    state.currencies[0] ||
    null;

  if (!currentCurrency) {
    const fallbackMeta = getDefaultCurrencyMeta(DEFAULT_PRIMARY_CURRENCY);
    await prisma.$executeRaw`
      INSERT INTO "tenantCurrencies" (
        "id",
        "tenantId",
        "code",
        "name",
        "symbol",
        "isCurrent",
        "isSecondary",
        "isActive",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        ${`cur_${tenantId}_${DEFAULT_PRIMARY_CURRENCY}`},
        ${tenantId},
        ${DEFAULT_PRIMARY_CURRENCY},
        ${fallbackMeta.name},
        ${fallbackMeta.symbol},
        ${true},
        ${false},
        ${true},
        NOW(),
        NOW()
      )
      ON CONFLICT ("tenantId", "code") DO NOTHING
    `;

    const refreshedState = await loadTenantCurrencyState(prisma, tenantId);
    currentCurrency = refreshedState.currencies.find((currency) => currency.isCurrent) ||
      refreshedState.currencies[0] ||
      null;
    state.currencies = refreshedState.currencies;
    state.conversions = refreshedState.conversions;
  }

  if (currentCurrency && !currentCurrency.isCurrent) {
    await prisma.$executeRaw`
      UPDATE "tenantCurrencies"
      SET
        "isCurrent" = CASE WHEN "id" = ${currentCurrency.id} THEN true ELSE false END,
        "updatedAt" = NOW()
      WHERE "tenantId" = ${tenantId}
    `;
  }

  let secondaryCurrency =
    state.currencies.find(
      (currency) =>
        currency.isSecondary &&
        currency.isActive &&
        currency.code !== currentCurrency?.code,
    ) ||
    state.currencies.find(
      (currency) => currency.isSecondary && currency.code !== currentCurrency?.code,
    ) ||
    null;

  if (secondaryCurrency && secondaryCurrency.code === currentCurrency?.code) {
    await prisma.$executeRaw`
      UPDATE "tenantCurrencies"
      SET
        "isSecondary" = false,
        "updatedAt" = NOW()
      WHERE "tenantId" = ${tenantId}
        AND "id" = ${secondaryCurrency.id}
    `;
    secondaryCurrency = null;
  }

  const exchangeRate = secondaryCurrency
    ? findConversionRate(
        state.conversions,
        currentCurrency?.code,
        secondaryCurrency.code,
      )
    : null;

  await prisma.$executeRaw`
    UPDATE "tenants"
    SET
      "primaryCurrencyCode" = ${currentCurrency?.code || DEFAULT_PRIMARY_CURRENCY},
      "secondaryCurrencyCode" = ${secondaryCurrency?.code || null},
      "exchangeRate" = ${exchangeRate}
    WHERE "id" = ${tenantId}
  `;
};

const mapTenantCurrencySettings = (row = {}) => {
  const currencies = Array.isArray(row.currencies)
    ? row.currencies.map(mapCurrencyRow)
    : [];
  const conversions = Array.isArray(row.conversions)
    ? row.conversions.map(mapConversionRow)
    : [];
  const currentCurrency =
    currencies.find((currency) => currency.isCurrent && currency.isActive) ||
    currencies.find((currency) => currency.isCurrent) ||
    currencies.find((currency) => currency.isActive) ||
    currencies[0] ||
    null;

  const primaryCurrencyCode = normalizeCurrencyCode(
    currentCurrency?.code || row.primaryCurrencyCode,
    DEFAULT_PRIMARY_CURRENCY,
  );

  const secondaryCurrencyCode = row.secondaryCurrencyCode
    ? normalizeCurrencyCode(row.secondaryCurrencyCode, "")
    : (
        currencies.find(
          (currency) => currency.isSecondary && currency.code !== primaryCurrencyCode,
        )?.code || null
      );

  const graphRate = secondaryCurrencyCode
    ? findConversionRate(conversions, primaryCurrencyCode, secondaryCurrencyCode)
    : null;
  const legacyRate = parseExchangeRate(row.exchangeRate);

  return {
    id: row.id || "currency-settings",
    currentCurrencyCode: primaryCurrencyCode,
    primaryCurrencyCode,
    secondaryCurrencyCode:
      secondaryCurrencyCode && secondaryCurrencyCode !== primaryCurrencyCode
        ? secondaryCurrencyCode
        : null,
    exchangeRate: graphRate || legacyRate || null,
    currencies,
    conversions,
  };
};

const listTenantCurrencies = async (prisma, tenantId, { skipBootstrap = false } = {}) => {
  await ensureTenantCurrencyColumns(prisma);
  if (!skipBootstrap) {
    await bootstrapTenantCurrencyCatalog(prisma, tenantId);
  }

  const rows = await prisma.$queryRaw`
    SELECT
      "id",
      "code",
      "name",
      "symbol",
      "isCurrent",
      "isSecondary",
      "isActive",
      "createdAt",
      "updatedAt"
    FROM "tenantCurrencies"
    WHERE "tenantId" = ${tenantId}
    ORDER BY "isCurrent" DESC, "isSecondary" DESC, "code" ASC
  `;

  return rows.map(mapCurrencyRow);
};

const listTenantCurrencyConversions = async (
  prisma,
  tenantId,
  { skipBootstrap = false } = {},
) => {
  await ensureTenantCurrencyColumns(prisma);
  if (!skipBootstrap) {
    await bootstrapTenantCurrencyCatalog(prisma, tenantId);
  }

  const rows = await prisma.$queryRaw`
    SELECT
      "id",
      "fromCurrencyCode",
      "toCurrencyCode",
      "rate",
      "createdAt",
      "updatedAt"
    FROM "tenantCurrencyConversions"
    WHERE "tenantId" = ${tenantId}
    ORDER BY "fromCurrencyCode" ASC, "toCurrencyCode" ASC
  `;

  return rows.map(mapConversionRow);
};

const loadTenantCurrencySettings = async (prisma, tenantId) => {
  await syncTenantCurrencyColumns(prisma, tenantId);
  const state = await loadTenantCurrencyState(prisma, tenantId);

  if (!state.tenantExists) {
    return mapTenantCurrencySettings({
      id: "currency-settings",
      primaryCurrencyCode: DEFAULT_PRIMARY_CURRENCY,
      secondaryCurrencyCode: null,
      exchangeRate: null,
      currencies: [],
      conversions: [],
    });
  }

  return mapTenantCurrencySettings({
    ...state.tenant,
    currencies: state.currencies,
    conversions: state.conversions,
  });
};

const convertAmount = (amount, fromCurrencyCode, toCurrencyCode, settings = {}) => {
  const numericAmount = Number(amount || 0);
  if (!Number.isFinite(numericAmount)) {
    return 0;
  }

  const fromCode = normalizeCurrencyCode(fromCurrencyCode, DEFAULT_PRIMARY_CURRENCY);
  const toCode = normalizeCurrencyCode(toCurrencyCode, DEFAULT_PRIMARY_CURRENCY);
  if (fromCode === toCode) {
    return numericAmount;
  }

  const conversions = Array.isArray(settings.conversions) ? settings.conversions : [];
  const graphRate = findConversionRate(conversions, fromCode, toCode);
  if (graphRate) {
    return numericAmount * graphRate;
  }

  const primaryCurrencyCode = normalizeCurrencyCode(
    settings.primaryCurrencyCode,
    DEFAULT_PRIMARY_CURRENCY,
  );
  const secondaryCurrencyCode = settings.secondaryCurrencyCode
    ? normalizeCurrencyCode(settings.secondaryCurrencyCode, "")
    : null;
  const exchangeRate = parseExchangeRate(settings.exchangeRate);

  if (!secondaryCurrencyCode || !exchangeRate) {
    return numericAmount;
  }

  if (fromCode === primaryCurrencyCode && toCode === secondaryCurrencyCode) {
    return numericAmount * exchangeRate;
  }

  if (fromCode === secondaryCurrencyCode && toCode === primaryCurrencyCode) {
    return numericAmount / exchangeRate;
  }

  return numericAmount;
};

module.exports = {
  DEFAULT_PRIMARY_CURRENCY,
  DEFAULT_CURRENCY_CATALOG,
  normalizeCurrencyCode,
  parseExchangeRate,
  getDefaultCurrencyMeta,
  ensureTenantCurrencyColumns,
  mapCurrencyRow,
  mapConversionRow,
  findConversionRate,
  mapTenantCurrencySettings,
  bootstrapTenantCurrencyCatalog,
  syncTenantCurrencyColumns,
  listTenantCurrencies,
  listTenantCurrencyConversions,
  loadTenantCurrencySettings,
  convertAmount,
};
