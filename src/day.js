const EPOCH_UTC = Date.UTC(2024, 5, 23);
const DAY_MS = 86_400_000;

/** The first day the public archive exposes. */
export const MIN_DAY = 8;
export const MAX_QUESTIONS = 10;

export function dayFromDate(date = new Date()) {
  const midnight = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor((midnight - EPOCH_UTC) / DAY_MS);
}

export function todayDay() {
  return dayFromDate(new Date());
}

export function dateFromDay(day) {
  return new Date(EPOCH_UTC + day * DAY_MS);
}

export function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

export function isoDateForDay(day) {
  return isoDate(dateFromDay(day));
}

export function parseIsoDate(input) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(input));
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

export function dayFromIso(input) {
  const date = parseIsoDate(input);
  if (!date) return null;
  return Math.floor((date.getTime() - EPOCH_UTC) / DAY_MS);
}

export function formatDate(date, { weekday = true } = {}) {
  const options = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  };
  if (weekday) options.weekday = 'short';
  return new Intl.DateTimeFormat('en-GB', options).format(date).replace(',', '');
}

export function formatDayDate(day, options) {
  return formatDate(dateFromDay(day), options);
}

export function formatDayDateShort(day) {
  return formatDayDate(day, { weekday: false });
}
