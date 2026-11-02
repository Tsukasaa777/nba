import test from 'node:test';
import assert from 'node:assert/strict';
import { easternDate, nbaScheduleFetchDates } from '../supabase/functions/sync-nba/sportapi';

test('Philippine morning has previous US basketball day, includes future Nov 3 slate', () => {
  const now = new Date('2026-11-02T03:04:00Z'); // Nov 2, 11:04 AM Manila
  assert.equal(easternDate(now), '2026-11-01');
  assert.deepEqual(nbaScheduleFetchDates(now), ['2026-10-31', '2026-11-01', '2026-11-02']);
});

test('future NBA calendar dates refresh without spamming provider every 15 minutes', () => {
  assert.deepEqual(nbaScheduleFetchDates(new Date('2026-11-02T03:30:00Z')),
    ['2026-10-31', '2026-11-01']);
  assert.deepEqual(nbaScheduleFetchDates(new Date('2026-11-02T06:00:00Z')),
    ['2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03']);
});

test('US daylight saving boundary does not shift a PHT slate to the wrong day', () => {
  const before = nbaScheduleFetchDates(new Date('2026-11-01T05:00:00Z'));
  const after = nbaScheduleFetchDates(new Date('2026-11-02T06:00:00Z'));
  assert.equal(before[1], '2026-11-01');
  assert.equal(after[1], '2026-11-02');
});
