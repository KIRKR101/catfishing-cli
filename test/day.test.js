import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MIN_DAY,
  dateFromDay,
  dayFromDate,
  dayFromIso,
  formatDayDate,
  isoDateForDay,
  parseIsoDate,
} from '../src/day.js';

test('day 865 is 5 November 2026', () => {
  assert.equal(dayFromDate(new Date(2026, 10, 5)), 865);
  assert.equal(isoDateForDay(865), '2026-11-05');
  assert.equal(formatDayDate(865), 'Thu 5 Nov 2026');
});

test('the archive starts at day 8, 1 July 2024', () => {
  assert.equal(MIN_DAY, 8);
  assert.equal(isoDateForDay(MIN_DAY), '2024-07-01');
  assert.equal(dayFromDate(new Date(2024, 6, 1)), 8);
});

test('ISO dates round-trip through day numbers', () => {
  assert.equal(dayFromIso('2026-11-05'), 865);
  assert.equal(dayFromIso('2024-07-01'), 8);
  assert.equal(dayFromIso('2026-02-30'), null);
  assert.equal(dayFromIso('not-a-date'), null);
  assert.equal(parseIsoDate('2026-02-30'), null);
});

test('dateFromDay is UTC midnight', () => {
  const date = dateFromDay(865);
  assert.equal(date.toISOString(), '2026-11-05T00:00:00.000Z');
});
