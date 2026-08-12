import { Temporal } from "@js-temporal/polyfill";

export const NEW_YORK_TIME_ZONE = "America/New_York";

export function getNewYorkNow(now = new Date()) {
  return Temporal.Instant.fromEpochMilliseconds(now.getTime())
    .toZonedDateTimeISO(NEW_YORK_TIME_ZONE);
}

export function getNewYorkDateKey(now = new Date()) {
  return getNewYorkNow(now).toPlainDate().toString();
}

export function isNewYorkWeekdayDateKey(dateKey: string) {
  const date = Temporal.PlainDate.from(dateKey);
  return date.dayOfWeek >= 1 && date.dayOfWeek <= 5;
}

export function getNewYorkWeekKeyFromDateKey(dateKey: string) {
  const date = Temporal.PlainDate.from(dateKey);
  return date.subtract({ days: date.dayOfWeek - 1 }).toString();
}

export function getNewYorkWeekKey(now = new Date()) {
  return getNewYorkWeekKeyFromDateKey(getNewYorkDateKey(now));
}

export function getEligibleDailyCycleKey(now = new Date()) {
  const dateKey = getNewYorkDateKey(now);
  return isNewYorkWeekdayDateKey(dateKey) ? dateKey : null;
}

export function getNextEligibleDailyCycleKey(now = new Date()) {
  let date = getNewYorkNow(now).toPlainDate();

  while (date.dayOfWeek > 5) {
    date = date.add({ days: 1 });
  }

  return date.toString();
}

export function getPreviousNewYorkDateKey(now = new Date()) {
  return getNewYorkNow(now).toPlainDate().subtract({ days: 1 }).toString();
}

export function countWeekKeysBetween(startKey: string, endKey: string) {
  const start = Temporal.PlainDate.from(startKey);
  const end = Temporal.PlainDate.from(endKey);
  return Math.trunc(end.since(start, { largestUnit: "days" }).days / 7);
}

export function isRecurringRolloverTime(now = new Date()) {
  const ny = getNewYorkNow(now);
  return ny.hour === 0 && ny.minute === 5;
}

// Both UTC cron entries are retained for DST. Only the one that is actually
// 23:59 in New York should perform the rollover.
export function isDailyRolloverTime(now = new Date()) {
  const ny = getNewYorkNow(now);
  return ny.hour === 23 && ny.minute === 59;
}

export function countWeekdaysBetween(startDateKey: string, endDateKey: string) {
  let cursor = Temporal.PlainDate.from(startDateKey);
  const end = Temporal.PlainDate.from(endDateKey);
  let weekdays = 0;

  while (Temporal.PlainDate.compare(cursor, end) < 0) {
    cursor = cursor.add({ days: 1 });

    if (cursor.dayOfWeek >= 1 && cursor.dayOfWeek <= 5) {
      weekdays += 1;
    }
  }

  return weekdays;
}
