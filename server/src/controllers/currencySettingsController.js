const { randomUUID } = require("crypto");
const prisma = require("../config/prisma");
const { emitToTenant } = require("../socket");
const {
  DEFAULT_PRIMARY_CURRENCY,
  getDefaultCurrencyMeta,
  normalizeCurrencyCode,
  parseExchangeRate,
  ensureTenantCurrencyColumns,
  listTenantCurrencies,
  listTenantCurrencyConversions,
  loadTenantCurrencySettings,
  syncTenantCurrencyColumns,
  findConversionRate,
} = require("../utils/currencySettings");

const emitCurrencySettingsUpdated = async (tenantId) => {
  const settings = await loadTenantCurrencySettings(prisma, tenantId);
  emitToTenant(tenantId, "currency:updated", settings);
  return settings;
};

const textValue = (value) => {
  const normalized = String(value || "").trim();
  return normalized ? normalized : null;
};

const booleanValue = (value, fallback = false) => {
  if (value === undefined) return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;

  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (["true", "1", "oui", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "non", "no", "off", ""].includes(normalized)) {
    return false;
  }

  return fallback;
};

const mapCurrencyListRows = (currencies = [], conversions = []) => {
  const conversionCountByCode = conversions.reduce((accumulator, conversion) => {
    const currentCount = accumulator.get(conversion.fromCurrencyCode) || 0;
    accumulator.set(conversion.fromCurrencyCode, currentCount + 1);
    return accumulator;
  }, new Map());

  return currencies.map((currency) => ({
    ...currency,
    conversionCount: conversionCountByCode.get(currency.code) || 0,
  }));
};

const getCurrencyById = async (tenantId, id) => {
  await ensureTenantCurrencyColumns(prisma);

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
      AND "id" = ${id}
    LIMIT 1
  `;

  return rows[0] || null;
};

const getCurrencyByCode = async (tenantId, code) => {
  const normalizedCode = normalizeCurrencyCode(code, "");
  if (!normalizedCode) return null;

  await ensureTenantCurrencyColumns(prisma);

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
      AND "code" = ${normalizedCode}
    LIMIT 1
  `;

  return rows[0] || null;
};

const upsertCurrencyStub = async (tenantId, code) => {
  const normalizedCode = normalizeCurrencyCode(code, DEFAULT_PRIMARY_CURRENCY);
  const existingCurrency = await getCurrencyByCode(tenantId, normalizedCode);
  if (existingCurrency) {
    return existingCurrency;
  }

  const meta = getDefaultCurrencyMeta(normalizedCode);
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
      ${randomUUID()},
      ${tenantId},
      ${normalizedCode},
      ${meta.name || normalizedCode},
      ${meta.symbol},
      ${false},
      ${false},
      ${true},
      NOW(),
      NOW()
    )
    ON CONFLICT ("tenantId", "code") DO NOTHING
  `;

  return getCurrencyByCode(tenantId, normalizedCode);
};

const normalizeConversions = (items = [], sourceCurrencyCode) => {
  const sourceCode = normalizeCurrencyCode(sourceCurrencyCode, "");
  const seenTargets = new Set();

  return (Array.isArray(items) ? items : [])
    .map((item) => {
      const itemFromCurrencyCode = item?.fromCurrencyCode
        ? normalizeCurrencyCode(item.fromCurrencyCode, "")
        : sourceCode;
      const toCurrencyCode = normalizeCurrencyCode(item?.toCurrencyCode, "");
      const rate = parseExchangeRate(item?.rate);

      if (!itemFromCurrencyCode) {
        throw Object.assign(new Error("La devise de depart d'une conversion est invalide."), {
          status: 400,
        });
      }

      if (itemFromCurrencyCode !== sourceCode) {
        throw Object.assign(
          new Error(
            "La devise de depart doit correspondre a la devise en cours de configuration.",
          ),
          { status: 400 },
        );
      }

      if (!toCurrencyCode) {
        throw Object.assign(new Error("La devise cible d'une conversion est invalide."), {
          status: 400,
        });
      }

      if (!rate) {
        throw Object.assign(new Error("Le taux de conversion doit etre superieur a zero."), {
          status: 400,
        });
      }

      if (toCurrencyCode === itemFromCurrencyCode) {
        throw Object.assign(
          new Error("Une devise ne peut pas avoir une conversion vers elle-meme."),
          { status: 400 },
        );
      }

      if (seenTargets.has(toCurrencyCode)) {
        throw Object.assign(
          new Error("Une devise cible ne peut etre renseignee qu'une seule fois."),
          { status: 400 },
        );
      }

      seenTargets.add(toCurrencyCode);

      return {
        fromCurrencyCode: itemFromCurrencyCode,
        toCurrencyCode,
        rate,
      };
    })
    .filter(Boolean);
};

const buildCurrencyPayload = async (tenantId, payload = {}, existingCurrency = null) => {
  const code = existingCurrency
    ? existingCurrency.code
    : normalizeCurrencyCode(payload.code, "");

  if (!code) {
    throw Object.assign(new Error("Le code devise est obligatoire et doit contenir 3 lettres."), {
      status: 400,
    });
  }

  if (
    existingCurrency &&
    payload.code !== undefined &&
    normalizeCurrencyCode(payload.code, existingCurrency.code) !== existingCurrency.code
  ) {
    throw Object.assign(new Error("Le code devise ne peut pas etre modifie."), {
      status: 400,
    });
  }

  const meta = getDefaultCurrencyMeta(code);
  const name = textValue(payload.name) || existingCurrency?.name || meta.name || code;
  const symbol =
    textValue(payload.symbol) ??
    existingCurrency?.symbol ??
    meta.symbol ??
    null;
  const currentCurrencies = await listTenantCurrencies(prisma, tenantId);
  const noCurrentDefined = !currentCurrencies.some((currency) => currency.isCurrent);
  const isCurrent = booleanValue(
    payload.isCurrent,
    existingCurrency ? existingCurrency.isCurrent : noCurrentDefined,
  );
  const isSecondary = booleanValue(
    payload.isSecondary,
    existingCurrency ? existingCurrency.isSecondary : false,
  );
  const isActive = booleanValue(
    payload.isActive,
    existingCurrency ? existingCurrency.isActive : true,
  );
  const conversions = normalizeConversions(payload.conversions || [], code);

  if (!name) {
    throw Object.assign(new Error("Le nom de la devise est obligatoire."), {
      status: 400,
    });
  }

  if (isCurrent && isSecondary) {
    throw Object.assign(
      new Error("Une devise en cours ne peut pas etre aussi la devise secondaire."),
      { status: 400 },
    );
  }

  if ((isCurrent || isSecondary) && !isActive) {
    throw Object.assign(
      new Error("Une devise inactive ne peut pas etre utilisee comme devise en cours ou secondaire."),
      { status: 400 },
    );
  }

  const targetCodes = conversions.map((conversion) => conversion.toCurrencyCode);
  if (targetCodes.length) {
    const targetCurrencies = await listTenantCurrencies(prisma, tenantId);
    const knownCodes = new Set(targetCurrencies.map((currency) => currency.code));

    targetCodes.forEach((targetCode) => {
      if (!knownCodes.has(targetCode)) {
        throw Object.assign(
          new Error(`La devise cible ${targetCode} doit etre creee avant sa conversion.`),
          { status: 400 },
        );
      }
    });
  }

  return {
    code,
    name,
    symbol,
    isCurrent,
    isSecondary,
    isActive,
    conversions,
  };
};

const replaceConversions = async (tenantId, fromCurrencyCode, conversions = []) => {
  await prisma.$executeRaw`
    DELETE FROM "tenantCurrencyConversions"
    WHERE "tenantId" = ${tenantId}
      AND "fromCurrencyCode" = ${fromCurrencyCode}
  `;

  for (const conversion of conversions) {
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
        ${randomUUID()},
        ${tenantId},
        ${conversion.fromCurrencyCode || fromCurrencyCode},
        ${conversion.toCurrencyCode},
        ${conversion.rate},
        NOW(),
        NOW()
      )
      ON CONFLICT ("tenantId", "fromCurrencyCode", "toCurrencyCode")
      DO UPDATE SET
        "rate" = EXCLUDED."rate",
        "updatedAt" = NOW()
    `;
  }
};

const setCurrentCurrencyById = async (tenantId, currencyId) => {
  await prisma.$executeRaw`
    UPDATE "tenantCurrencies"
    SET
      "isCurrent" = CASE WHEN "id" = ${currencyId} THEN true ELSE false END,
      "updatedAt" = NOW()
    WHERE "tenantId" = ${tenantId}
  `;
};

const setSecondaryCurrencyById = async (tenantId, currencyId = null) => {
  if (!currencyId) {
    await prisma.$executeRaw`
      UPDATE "tenantCurrencies"
      SET
        "isSecondary" = false,
        "updatedAt" = NOW()
      WHERE "tenantId" = ${tenantId}
    `;
    return;
  }

  await prisma.$executeRaw`
    UPDATE "tenantCurrencies"
    SET
      "isSecondary" = CASE WHEN "id" = ${currencyId} THEN true ELSE false END,
      "updatedAt" = NOW()
    WHERE "tenantId" = ${tenantId}
  `;
};

const getCurrencyDetail = async (tenantId, id) => {
  const baseCurrency = await getCurrencyById(tenantId, id);
  if (!baseCurrency) {
    return null;
  }

  const conversions = await listTenantCurrencyConversions(prisma, tenantId);
  return {
    ...baseCurrency,
    conversions: conversions.filter(
      (conversion) => conversion.fromCurrencyCode === baseCurrency.code,
    ),
    conversionCount: conversions.filter(
      (conversion) => conversion.fromCurrencyCode === baseCurrency.code,
    ).length,
  };
};

const getConversionById = async (tenantId, id) => {
  await ensureTenantCurrencyColumns(prisma);

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
      AND "id" = ${id}
    LIMIT 1
  `;

  return rows[0] || null;
};

const buildConversionPayload = async (tenantId, payload = {}, existingConversion = null) => {
  const fromCurrencyCode = normalizeCurrencyCode(
    payload.fromCurrencyCode || existingConversion?.fromCurrencyCode,
    "",
  );
  const toCurrencyCode = normalizeCurrencyCode(
    payload.toCurrencyCode || existingConversion?.toCurrencyCode,
    "",
  );
  const rate = parseExchangeRate(payload.rate ?? existingConversion?.rate);

  if (!fromCurrencyCode) {
    throw Object.assign(new Error("La devise de depart est obligatoire."), {
      status: 400,
    });
  }

  if (!toCurrencyCode) {
    throw Object.assign(new Error("La devise de conversion est obligatoire."), {
      status: 400,
    });
  }

  if (fromCurrencyCode === toCurrencyCode) {
    throw Object.assign(
      new Error("La devise de depart doit etre differente de la devise de conversion."),
      { status: 400 },
    );
  }

  if (!rate) {
    throw Object.assign(new Error("Le taux doit etre superieur a zero."), {
      status: 400,
    });
  }

  const currencies = await listTenantCurrencies(prisma, tenantId);
  const codes = new Set(currencies.map((currency) => currency.code));

  if (!codes.has(fromCurrencyCode)) {
    throw Object.assign(
      new Error(`La devise de depart ${fromCurrencyCode} n'existe pas.`),
      { status: 400 },
    );
  }

  if (!codes.has(toCurrencyCode)) {
    throw Object.assign(
      new Error(`La devise de conversion ${toCurrencyCode} n'existe pas.`),
      { status: 400 },
    );
  }

  return {
    fromCurrencyCode,
    toCurrencyCode,
    rate,
  };
};

const countCurrencyBusinessReferences = async (tenantId, currencyCode) => {
  const tableRefs = [
    { table: "products", column: "currencyCode", label: "articles/produits" },
    { table: "orders", column: "currencyCode", label: "ventes" },
    { table: "order_items", column: "currencyCode", label: "lignes de ventes" },
    { table: "payements", column: "currencyCode", label: "paiements" },
    { table: "purchaseOrderItems", column: "currencyCode", label: "commandes fournisseur" },
    { table: "stockEntryItems", column: "currencyCode", label: "entrees de stock" },
  ];

  const hits = [];

  for (const ref of tableRefs) {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS count FROM "${ref.table}" WHERE "tenantId" = $1 AND "${ref.column}" = $2`,
      tenantId,
      currencyCode,
    );
    const count = Number(rows?.[0]?.count || 0);
    if (count > 0) {
      hits.push({ label: ref.label, count });
    }
  }

  const conversionRows = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS count
    FROM "tenantCurrencyConversions"
    WHERE "tenantId" = ${tenantId}
      AND ("fromCurrencyCode" = ${currencyCode} OR "toCurrencyCode" = ${currencyCode})
  `;
  const conversionCount = Number(conversionRows?.[0]?.count || 0);
  if (conversionCount > 0) {
    hits.push({ label: "conversions", count: conversionCount });
  }

  return hits;
};

const listCurrencySettings = async (req, res) => {
  try {
    const currencies = await listTenantCurrencies(prisma, req.user.tenantId);
    const conversions = await listTenantCurrencyConversions(prisma, req.user.tenantId);
    return res.json(mapCurrencyListRows(currencies, conversions));
  } catch (error) {
    return res.status(error?.status || 500).json({
      message: error.message || "Impossible de charger les devises.",
    });
  }
};

const listCurrencyConversions = async (req, res) => {
  try {
    const conversions = await listTenantCurrencyConversions(prisma, req.user.tenantId);
    return res.json(conversions);
  } catch (error) {
    return res.status(error?.status || 500).json({
      message: error.message || "Impossible de charger les conversions de devise.",
    });
  }
};

const getCurrencySettingsById = async (req, res) => {
  try {
    const currency = await getCurrencyDetail(req.user.tenantId, req.params.id);
    if (!currency) {
      return res.status(404).json({ message: "Devise introuvable." });
    }

    return res.json(currency);
  } catch (error) {
    return res.status(error?.status || 500).json({
      message: error.message || "Impossible de charger cette devise.",
    });
  }
};

const getCurrencyConversionById = async (req, res) => {
  try {
    const conversion = await getConversionById(req.user.tenantId, req.params.id);
    if (!conversion) {
      return res.status(404).json({ message: "Conversion introuvable." });
    }

    return res.json(conversion);
  } catch (error) {
    return res.status(error?.status || 500).json({
      message: error.message || "Impossible de charger cette conversion.",
    });
  }
};

const getCurrentCurrencySettings = async (req, res) => {
  try {
    const settings = await loadTenantCurrencySettings(prisma, req.user.tenantId);
    return res.json(settings);
  } catch (error) {
    return res.status(error?.status || 500).json({
      message: error.message || "Impossible de charger les parametres de devise.",
    });
  }
};

const createCurrency = async (req, res) => {
  try {
    await ensureTenantCurrencyColumns(prisma);
    const payload = await buildCurrencyPayload(req.user.tenantId, req.body || {});
    const existingCurrency = await getCurrencyByCode(req.user.tenantId, payload.code);

    if (existingCurrency) {
      return res.status(409).json({
        message: "Cette devise existe deja pour ce tenant.",
      });
    }

    const id = randomUUID();
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
        ${id},
        ${req.user.tenantId},
        ${payload.code},
        ${payload.name},
        ${payload.symbol},
        ${payload.isCurrent},
        ${payload.isSecondary},
        ${payload.isActive},
        NOW(),
        NOW()
      )
    `;

    await replaceConversions(req.user.tenantId, payload.code, payload.conversions);

    if (payload.isCurrent) {
      await setCurrentCurrencyById(req.user.tenantId, id);
    }

    if (payload.isSecondary) {
      await setSecondaryCurrencyById(req.user.tenantId, id);
    }

    await syncTenantCurrencyColumns(prisma, req.user.tenantId);
    await emitCurrencySettingsUpdated(req.user.tenantId);
    const currency = await getCurrencyDetail(req.user.tenantId, id);
    return res.status(201).json(currency);
  } catch (error) {
    return res.status(error?.status || 500).json({
      message: error.message || "Impossible de creer la devise.",
    });
  }
};

const createCurrencyConversion = async (req, res) => {
  try {
    await ensureTenantCurrencyColumns(prisma);
    const payload = await buildConversionPayload(req.user.tenantId, req.body || {});
    const duplicateRows = await prisma.$queryRaw`
      SELECT "id"
      FROM "tenantCurrencyConversions"
      WHERE "tenantId" = ${req.user.tenantId}
        AND "fromCurrencyCode" = ${payload.fromCurrencyCode}
        AND "toCurrencyCode" = ${payload.toCurrencyCode}
      LIMIT 1
    `;

    if (duplicateRows[0]) {
      return res.status(409).json({
        message: "Cette conversion existe deja.",
      });
    }

    const id = randomUUID();
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
        ${id},
        ${req.user.tenantId},
        ${payload.fromCurrencyCode},
        ${payload.toCurrencyCode},
        ${payload.rate},
        NOW(),
        NOW()
      )
    `;

    await syncTenantCurrencyColumns(prisma, req.user.tenantId);
    await emitCurrencySettingsUpdated(req.user.tenantId);
    const conversion = await getConversionById(req.user.tenantId, id);
    return res.status(201).json(conversion);
  } catch (error) {
    return res.status(error?.status || 500).json({
      message: error.message || "Impossible de creer la conversion de devise.",
    });
  }
};

const updateCurrency = async (req, res) => {
  try {
    await ensureTenantCurrencyColumns(prisma);
    const existingCurrency = await getCurrencyById(req.user.tenantId, req.params.id);

    if (!existingCurrency) {
      return res.status(404).json({ message: "Devise introuvable." });
    }

    const payload = await buildCurrencyPayload(
      req.user.tenantId,
      req.body || {},
      existingCurrency,
    );

    if (existingCurrency.isCurrent && !payload.isCurrent) {
      throw Object.assign(
        new Error("Definissez d'abord une autre devise en cours avant de retirer celle-ci."),
        { status: 400 },
      );
    }

    await prisma.$executeRaw`
      UPDATE "tenantCurrencies"
      SET
        "name" = ${payload.name},
        "symbol" = ${payload.symbol},
        "isCurrent" = ${payload.isCurrent},
        "isSecondary" = ${payload.isSecondary},
        "isActive" = ${payload.isActive},
        "updatedAt" = NOW()
      WHERE "tenantId" = ${req.user.tenantId}
        AND "id" = ${req.params.id}
    `;

    await replaceConversions(req.user.tenantId, payload.code, payload.conversions);

    if (payload.isCurrent) {
      await setCurrentCurrencyById(req.user.tenantId, req.params.id);
    }

    if (payload.isSecondary) {
      await setSecondaryCurrencyById(req.user.tenantId, req.params.id);
    } else if (existingCurrency.isSecondary) {
      await setSecondaryCurrencyById(req.user.tenantId, null);
    }

    await syncTenantCurrencyColumns(prisma, req.user.tenantId);
    await emitCurrencySettingsUpdated(req.user.tenantId);
    const currency = await getCurrencyDetail(req.user.tenantId, req.params.id);
    return res.json(currency);
  } catch (error) {
    return res.status(error?.status || 500).json({
      message: error.message || "Impossible de mettre a jour la devise.",
    });
  }
};

const updateCurrencyConversion = async (req, res) => {
  try {
    await ensureTenantCurrencyColumns(prisma);
    const existingConversion = await getConversionById(req.user.tenantId, req.params.id);

    if (!existingConversion) {
      return res.status(404).json({ message: "Conversion introuvable." });
    }

    const payload = await buildConversionPayload(
      req.user.tenantId,
      req.body || {},
      existingConversion,
    );

    const duplicateRows = await prisma.$queryRaw`
      SELECT "id"
      FROM "tenantCurrencyConversions"
      WHERE "tenantId" = ${req.user.tenantId}
        AND "fromCurrencyCode" = ${payload.fromCurrencyCode}
        AND "toCurrencyCode" = ${payload.toCurrencyCode}
        AND "id" <> ${req.params.id}
      LIMIT 1
    `;

    if (duplicateRows[0]) {
      return res.status(409).json({
        message: "Cette conversion existe deja.",
      });
    }

    await prisma.$executeRaw`
      UPDATE "tenantCurrencyConversions"
      SET
        "fromCurrencyCode" = ${payload.fromCurrencyCode},
        "toCurrencyCode" = ${payload.toCurrencyCode},
        "rate" = ${payload.rate},
        "updatedAt" = NOW()
      WHERE "tenantId" = ${req.user.tenantId}
        AND "id" = ${req.params.id}
    `;

    await syncTenantCurrencyColumns(prisma, req.user.tenantId);
    await emitCurrencySettingsUpdated(req.user.tenantId);
    const conversion = await getConversionById(req.user.tenantId, req.params.id);
    return res.json(conversion);
  } catch (error) {
    return res.status(error?.status || 500).json({
      message: error.message || "Impossible de mettre a jour la conversion de devise.",
    });
  }
};

const saveCurrencySettings = async (req, res) => {
  try {
    await ensureTenantCurrencyColumns(prisma);

    const primaryCurrencyCode = normalizeCurrencyCode(
      req.body?.primaryCurrencyCode || req.body?.currentCurrencyCode,
      "",
    );

    if (!primaryCurrencyCode) {
      throw Object.assign(new Error("La devise en cours est invalide."), {
        status: 400,
      });
    }

    const secondaryCurrencyCode = req.body?.secondaryCurrencyCode
      ? normalizeCurrencyCode(req.body.secondaryCurrencyCode, "")
      : null;
    const exchangeRate = parseExchangeRate(req.body?.exchangeRate);

    if (secondaryCurrencyCode && secondaryCurrencyCode === primaryCurrencyCode) {
      throw Object.assign(
        new Error("La devise secondaire doit etre differente de la devise en cours."),
        { status: 400 },
      );
    }

    const primaryCurrency = await upsertCurrencyStub(
      req.user.tenantId,
      primaryCurrencyCode,
    );
    await setCurrentCurrencyById(req.user.tenantId, primaryCurrency.id);

    if (secondaryCurrencyCode) {
      const secondaryCurrency = await upsertCurrencyStub(
        req.user.tenantId,
        secondaryCurrencyCode,
      );
      await setSecondaryCurrencyById(req.user.tenantId, secondaryCurrency.id);

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
            ${randomUUID()},
            ${req.user.tenantId},
            ${primaryCurrencyCode},
            ${secondaryCurrencyCode},
            ${exchangeRate},
            NOW(),
            NOW()
          )
          ON CONFLICT ("tenantId", "fromCurrencyCode", "toCurrencyCode")
          DO UPDATE SET
            "rate" = EXCLUDED."rate",
            "updatedAt" = NOW()
        `;
      } else {
        const conversions = await listTenantCurrencyConversions(prisma, req.user.tenantId);
        const knownRate = findConversionRate(
          conversions,
          primaryCurrencyCode,
          secondaryCurrencyCode,
        );

        if (!knownRate) {
          throw Object.assign(
            new Error(
              "Aucun taux de conversion n'est configure entre la devise en cours et la devise secondaire.",
            ),
            { status: 400 },
          );
        }
      }
    } else {
      await setSecondaryCurrencyById(req.user.tenantId, null);
    }

    await syncTenantCurrencyColumns(prisma, req.user.tenantId);
    const settings = await emitCurrencySettingsUpdated(req.user.tenantId);
    return res.json(settings);
  } catch (error) {
    return res.status(error?.status || 500).json({
      message: error.message || "Impossible d'enregistrer les parametres de devise.",
    });
  }
};

const setCurrentCurrency = async (req, res) => {
  try {
    const currency = await getCurrencyById(req.user.tenantId, req.params.id);
    if (!currency) {
      return res.status(404).json({ message: "Devise introuvable." });
    }

    if (!currency.isActive) {
      return res.status(400).json({
        message: "Une devise inactive ne peut pas etre definie comme devise en cours.",
      });
    }

    await setCurrentCurrencyById(req.user.tenantId, req.params.id);
    await syncTenantCurrencyColumns(prisma, req.user.tenantId);
    const settings = await emitCurrencySettingsUpdated(req.user.tenantId);
    return res.json(settings);
  } catch (error) {
    return res.status(error?.status || 500).json({
      message: error.message || "Impossible de definir la devise en cours.",
    });
  }
};

const setSecondaryCurrency = async (req, res) => {
  try {
    const currency = await getCurrencyById(req.user.tenantId, req.params.id);
    if (!currency) {
      return res.status(404).json({ message: "Devise introuvable." });
    }

    if (!currency.isActive) {
      return res.status(400).json({
        message: "Une devise inactive ne peut pas etre definie comme devise secondaire.",
      });
    }

    if (currency.isCurrent) {
      return res.status(400).json({
        message: "La devise en cours ne peut pas etre aussi la devise secondaire.",
      });
    }

    await setSecondaryCurrencyById(req.user.tenantId, req.params.id);
    await syncTenantCurrencyColumns(prisma, req.user.tenantId);
    const settings = await emitCurrencySettingsUpdated(req.user.tenantId);
    return res.json(settings);
  } catch (error) {
    return res.status(error?.status || 500).json({
      message: error.message || "Impossible de definir la devise secondaire.",
    });
  }
};

const unsetSecondaryCurrency = async (req, res) => {
  try {
    const currency = await getCurrencyById(req.user.tenantId, req.params.id);
    if (!currency) {
      return res.status(404).json({ message: "Devise introuvable." });
    }

    await setSecondaryCurrencyById(req.user.tenantId, null);
    await syncTenantCurrencyColumns(prisma, req.user.tenantId);
    const settings = await emitCurrencySettingsUpdated(req.user.tenantId);
    return res.json(settings);
  } catch (error) {
    return res.status(error?.status || 500).json({
      message: error.message || "Impossible de retirer la devise secondaire.",
    });
  }
};

const deleteCurrencyConversion = async (req, res) => {
  try {
    await ensureTenantCurrencyColumns(prisma);
    const existingConversion = await getConversionById(req.user.tenantId, req.params.id);

    if (!existingConversion) {
      return res.status(404).json({ message: "Conversion introuvable." });
    }

    const settings = await loadTenantCurrencySettings(prisma, req.user.tenantId);
    const currentPairMatches =
      settings.primaryCurrencyCode &&
      settings.secondaryCurrencyCode &&
      existingConversion.fromCurrencyCode === settings.primaryCurrencyCode &&
      existingConversion.toCurrencyCode === settings.secondaryCurrencyCode;

    if (currentPairMatches) {
      return res.status(400).json({
        message:
          "Impossible de supprimer la conversion utilisee entre la devise en cours et la devise secondaire.",
      });
    }

    await prisma.$executeRaw`
      DELETE FROM "tenantCurrencyConversions"
      WHERE "tenantId" = ${req.user.tenantId}
        AND "id" = ${req.params.id}
    `;

    await syncTenantCurrencyColumns(prisma, req.user.tenantId);
    await emitCurrencySettingsUpdated(req.user.tenantId);
    return res.status(204).send();
  } catch (error) {
    return res.status(error?.status || 500).json({
      message: error.message || "Impossible de supprimer la conversion de devise.",
    });
  }
};

const deleteCurrency = async (req, res) => {
  try {
    await ensureTenantCurrencyColumns(prisma);
    const currency = await getCurrencyById(req.user.tenantId, req.params.id);
    if (!currency) {
      return res.status(404).json({ message: "Devise introuvable." });
    }

    if (currency.isCurrent) {
      return res.status(400).json({
        message: "Impossible de supprimer la devise en cours.",
      });
    }

    const currencies = await listTenantCurrencies(prisma, req.user.tenantId);
    if (currencies.length <= 1) {
      return res.status(400).json({
        message: "Au moins une devise doit rester configuree.",
      });
    }

    const refs = await countCurrencyBusinessReferences(
      req.user.tenantId,
      currency.code,
    );
    if (refs.length) {
      const refLabel = refs
        .map((ref) => `${ref.label} (${ref.count})`)
        .join(", ");
      return res.status(400).json({
        message: `Impossible de supprimer cette devise: elle est deja referencee dans ${refLabel}.`,
      });
    }

    await prisma.$executeRaw`
      DELETE FROM "tenantCurrencies"
      WHERE "tenantId" = ${req.user.tenantId}
        AND "id" = ${req.params.id}
    `;

    await syncTenantCurrencyColumns(prisma, req.user.tenantId);
    await emitCurrencySettingsUpdated(req.user.tenantId);
    return res.status(204).send();
  } catch (error) {
    return res.status(error?.status || 500).json({
      message: error.message || "Impossible de supprimer la devise.",
    });
  }
};

module.exports = {
  listCurrencySettings,
  listCurrencyConversions,
  getCurrencySettingsById,
  getCurrencyConversionById,
  getCurrentCurrencySettings,
  createCurrency,
  createCurrencyConversion,
  updateCurrency,
  updateCurrencyConversion,
  saveCurrencySettings,
  setCurrentCurrency,
  setSecondaryCurrency,
  unsetSecondaryCurrency,
  deleteCurrency,
  deleteCurrencyConversion,
};
