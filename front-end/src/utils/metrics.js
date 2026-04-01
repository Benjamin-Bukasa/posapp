export const startOfMonth = (date) =>
  new Date(date.getFullYear(), date.getMonth(), 1);

export const addMonths = (date, amount) =>
  new Date(date.getFullYear(), date.getMonth() + amount, 1);

export const getMonthRange = (date = new Date()) => {
  const start = startOfMonth(date);
  const end = addMonths(start, 1);
  return { start, end };
};

export const getPreviousMonthRange = (date = new Date()) => {
  const currentStart = startOfMonth(date);
  const prevStart = addMonths(currentStart, -1);
  return { start: prevStart, end: currentStart };
};

export const isWithinRange = (value, start, end) => {
  if (!value) return false;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date >= start && date < end;
};

export const percentChange = (current, previous, precision = 1) => {
  const curr = Number(current) || 0;
  const prev = Number(previous) || 0;
  if (prev === 0) return curr === 0 ? 0 : 100;
  const change = ((curr - prev) / Math.abs(prev)) * 100;
  return Number(change.toFixed(precision));
};
