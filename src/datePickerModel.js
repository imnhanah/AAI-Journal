const DATE_VALUE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseDateValue(value = '') {
  const match = DATE_VALUE.exec(String(value));
  if (!match) return null;
  const [, year, month, day] = match;
  // Construct at local noon. A date-only journal value must never be shifted by
  // an offset or a DST change when it is displayed in the user's time zone.
  const result = new Date(Number(year), Number(month) - 1, Number(day), 12);
  return result.getFullYear() === Number(year) && result.getMonth() === Number(month) - 1 && result.getDate() === Number(day) ? result : null;
}

export function isDateValue(value) {
  return Boolean(parseDateValue(value));
}

export function dateValueToday(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function dateWithinRange(value, min, max) {
  return isDateValue(value) && (!min || value >= min) && (!max || value <= max);
}
