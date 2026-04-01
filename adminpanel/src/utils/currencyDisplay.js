import useCurrencyStore from "../stores/currencyStore";
import {
  DEFAULT_CURRENCY_SETTINGS,
  DEFAULT_RECORD_CURRENCY,
  convertToPrimaryAmount,
  formatCurrencyAmount,
} from "./currency";

export const getCurrentCurrencySettings = () =>
  useCurrencyStore.getState?.().settings || DEFAULT_CURRENCY_SETTINGS;

export const getCurrentPrimaryCurrencyCode = () =>
  getCurrentCurrencySettings().primaryCurrencyCode;

export const convertToDisplayAmount = (
  amount,
  sourceCurrencyCode = DEFAULT_RECORD_CURRENCY,
) => convertToPrimaryAmount(amount, sourceCurrencyCode, getCurrentCurrencySettings());

export const formatMoney = (
  amount,
  sourceCurrencyCode = DEFAULT_RECORD_CURRENCY,
) =>
  formatCurrencyAmount(
    convertToDisplayAmount(amount, sourceCurrencyCode),
    getCurrentPrimaryCurrencyCode(),
  );
