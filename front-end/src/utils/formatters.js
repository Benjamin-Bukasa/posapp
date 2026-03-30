import useCurrencyStore from "../stores/currencyStore";
import {
  DEFAULT_CURRENCY_SETTINGS,
  DEFAULT_RECORD_CURRENCY,
  convertToPrimaryAmount,
  formatPrimaryAmount,
} from "./currency";

export const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

export const toDisplayAmount = (
  value,
  sourceCurrencyCode = DEFAULT_RECORD_CURRENCY,
) => {
  const settings =
    useCurrencyStore.getState?.().settings || DEFAULT_CURRENCY_SETTINGS;
  return convertToPrimaryAmount(value, sourceCurrencyCode, settings);
};

export const getDisplayCurrencyCode = () =>
  (useCurrencyStore.getState?.().settings || DEFAULT_CURRENCY_SETTINGS)
    .primaryCurrencyCode;

export const formatDisplayAmount = (value) => {
  const settings =
    useCurrencyStore.getState?.().settings || DEFAULT_CURRENCY_SETTINGS;
  return formatPrimaryAmount(Number(value || 0), settings);
};

export const formatAmount = (
  value,
  sourceCurrencyCode = DEFAULT_RECORD_CURRENCY,
) => {
  const settings =
    useCurrencyStore.getState?.().settings || DEFAULT_CURRENCY_SETTINGS;
  return formatPrimaryAmount(
    toDisplayAmount(value, sourceCurrencyCode),
    settings,
  );
};

export const formatName = (user) =>
  [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
  user?.name ||
  user?.email ||
  "N/A";

export const shortId = (value, prefix = "") => {
  if (!value) return "";
  const slice = String(value).replace(/-/g, "").slice(-6).toUpperCase();
  return prefix ? `${prefix}${slice}` : slice;
};
