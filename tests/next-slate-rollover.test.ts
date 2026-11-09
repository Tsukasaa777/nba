import test from 'node:test';
import assert from 'node:assert/strict';
import {nextResearchSlateDate} from '../src/lib/analytics';

test('NBA slate stays on the current PHT date through 12:59:59 PM',()=>{
 assert.equal(nextResearchSlateDate('2026-11-02T00:00:00Z'),'2026-11-02'); // 8 AM
 assert.equal(nextResearchSlateDate('2026-11-02T04:59:59Z'),'2026-11-02'); // 12:59 PM
});

test('NBA slate advances precisely at 1:00 PM PHT',()=>{
 assert.equal(nextResearchSlateDate('2026-11-02T05:00:00Z'),'2026-11-03'); // 1 PM
 assert.equal(nextResearchSlateDate('2026-11-02T06:00:00Z'),'2026-11-03'); // 2 PM
 assert.equal(nextResearchSlateDate('2026-11-02T15:59:59Z'),'2026-11-03'); // 11:59 PM
});

test('slate does not roll over again at midnight PHT',()=>{
 assert.equal(nextResearchSlateDate('2026-11-02T16:00:00Z'),'2026-11-03'); // midnight
 assert.equal(nextResearchSlateDate('2026-11-03T04:59:59Z'),'2026-11-03'); // 12:59 PM
 assert.equal(nextResearchSlateDate('2026-11-03T05:00:00Z'),'2026-11-04'); // 1 PM
});

test('PHT cutoff is independent of United States daylight saving time',()=>{
 assert.equal(nextResearchSlateDate('2026-11-01T04:59:59Z'),'2026-11-01');
 assert.equal(nextResearchSlateDate('2026-11-01T05:00:00Z'),'2026-11-02');
});
