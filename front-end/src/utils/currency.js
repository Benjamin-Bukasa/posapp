export const DEFAULT_CURRENCY_SETTINGS = {
  id: "currency-settings",
  primaryCurrencyCode: "USD",
  secondaryCurrencyCode: null,
  exchangeRate: null,
};

export const DEFAULT_RECORD_CURRENCY = "USD";

export const sanitizeCurrencyCode = (value, fallback = "USD") => {
  const code = String(value || fallback)
    .trim()
    .toUpperCase();

  return /^[A-Z]{3}$/.test(code) ? code : fallback;
};

export const normalizeCurrencySettings = (payload) => {
  const source = Array.isArray(payload) ? payload[0] || {} : payload || {};
  const currentFromCatalog =
    Array.isArray(source.currencies) &&
    source.currencies.find((currency) => currency?.isCurrent)?.code;
  const primaryCurrencyCode = sanitizeCurrencyCode(
    source.currentCurrencyCode || source.primaryCurrencyCode || currentFromCatalog,
    DEFAULT_CURRENCY_SETTINGS.primaryCurrencyCode,
  );
  const secondaryFromCatalog =
    Array.isArray(source.currencies) &&
    source.currencies.find(
      (currency) =>
        currency?.isSecondary &&
        String(currency?.code || "").toUpperCase() !== primaryCurrencyCode,
    )?.code;
  const secondaryCurrencyCode = source.secondaryCurrencyCode
    ? sanitizeCurrencyCode(source.secondaryCurrencyCode, "")
    : secondaryFromCatalog
      ? sanitizeCurrencyCode(secondaryFromCatalog, "")
      : null;
  const exchangeRate = Number(source.exchangeRate);

  return {
    id: source.id || DEFAULT_CURRENCY_SETTINGS.id,
    primaryCurrencyCode,
    secondaryCurrencyCode:
      secondaryCurrencyCode && secondaryCurrencyCode !== primaryCurrencyCode
        ? secondaryCurrencyCode
        : null,
    exchangeRate:
      secondaryCurrencyCode && Number.isFinite(exchangeRate) && exchangeRate > 0
        ? exchangeRate
        : null,
  };
};

export const hasSecondaryCurrency = (settings) =>
  Boolean(settings?.secondaryCurrencyCode && Number(settings?.exchangeRate) > 0);

export const convertCurrencyAmount = (
  amount,
  fromCurrencyCode,
  toCurrencyCode,
  settings = DEFAULT_CURRENCY_SETTINGS,
) => {
  const numericAmount = Number(amount || 0);
  if (!Number.isFinite(numericAmount)) {
    return 0;
  }

  const normalizedSettings = normalizeCurrencySettings(settings);
  const fromCode = sanitizeCurrencyCode(fromCurrencyCode, DEFAULT_RECORD_CURRENCY);
  const toCode = sanitizeCurrencyCode(
    toCurrencyCode,
    normalizedSettings.primaryCurrencyCode,
  );

  if (fromCode === toCode) {
    return numericAmount;
  }

  if (!hasSecondaryCurrency(normalizedSettings)) {
    return numericAmount;
  }

  const exchangeRate = Number(normalizedSettings.exchangeRate || 0);
  if (fromCode === normalizedSettings.primaryCurrencyCode) {
    if (toCode === normalizedSettings.secondaryCurrencyCode) {
      return numericAmount * exchangeRate;
    }
    return numericAmount;
  }

  if (fromCode === normalizedSettings.secondaryCurrencyCode) {
    if (toCode === normalizedSettings.primaryCurrencyCode) {
      return numericAmount / exchangeRate;
    }
    return numericAmount;
  }

  return numericAmount;
};

export const formatCurrencyAmount = (amount, currencyCode) => {
  const numericAmount = Number(amount || 0);
  const safeCode = sanitizeCurrencyCode(currencyCode, "USD");

  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: safeCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numericAmount);
  } catch (error) {
    return `${numericAmount.toFixed(2)} ${safeCode}`;
  }
};

export const formatPrimaryAmount = (amount, settings = DEFAULT_CURRENCY_SETTINGS) =>
  formatCurrencyAmount(amount, settings.primaryCurrencyCode);

export const convertToPrimaryAmount = (
  amount,
  sourceCurrencyCode = DEFAULT_RECORD_CURRENCY,
  settings = DEFAULT_CURRENCY_SETTINGS,
) =>
  convertCurrencyAmount(
    amount,
    sourceCurrencyCode,
    normalizeCurrencySettings(settings).primaryCurrencyCode,
    settings,
  );

export const formatConvertedPrimaryAmount = (
  amount,
  sourceCurrencyCode = DEFAULT_RECORD_CURRENCY,
  settings = DEFAULT_CURRENCY_SETTINGS,
) => formatPrimaryAmount(convertToPrimaryAmount(amount, sourceCurrencyCode, settings), settings);

export const convertToSecondaryAmount = (
  amount,
  settings = DEFAULT_CURRENCY_SETTINGS,
  sourceCurrencyCode = normalizeCurrencySettings(settings).primaryCurrencyCode,
) => {
  if (!hasSecondaryCurrency(settings)) {
    return null;
  }

  const normalizedSettings = normalizeCurrencySettings(settings);
  const primaryAmount = convertToPrimaryAmount(
    amount,
    sourceCurrencyCode,
    normalizedSettings,
  );

  return convertCurrencyAmount(
    primaryAmount,
    normalizedSettings.primaryCurrencyCode,
    normalizedSettings.secondaryCurrencyCode,
    normalizedSettings,
  );
};

export const formatSecondaryAmount = (
  amount,
  settings = DEFAULT_CURRENCY_SETTINGS,
  sourceCurrencyCode = normalizeCurrencySettings(settings).primaryCurrencyCode,
) => {
  const converted = convertToSecondaryAmount(amount, settings, sourceCurrencyCode);
  if (converted === null) {
    return null;
  }

  return formatCurrencyAmount(converted, settings.secondaryCurrencyCode);
};

export const buildSecondaryRateLabel = (
  settings = DEFAULT_CURRENCY_SETTINGS,
) => {
  if (!hasSecondaryCurrency(settings)) {
    return "";
  }

  return `1 ${settings.primaryCurrencyCode} = ${Number(settings.exchangeRate).toFixed(4)} ${settings.secondaryCurrencyCode}`;
};
