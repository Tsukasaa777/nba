import test from 'node:test';
import assert from 'node:assert/strict';
import {nextResearchSlateDate} from '../src/lib/analytics';

test('before 2 PM PHT the current-day NBA slate remains selected',()=>{
 assert.equal(nextResearchSlateDate('2026-11-02T05:59:59Z'),'2026-11-02');
 assert.equal(nextResearchSlateDate('2026-11-02T00:00:00Z'),'2026-11-02');
});

test('exactly 2 PM PHT rolls to tomorrow, not the day after',()=>{
 assert.equal(nextResearchSlateDate('2026-11-02T06:00:00Z'),'2026-11-03');
 assert.equal(nextResearchSlateDate('2026-11-02T15:59:59Z'),'2026-11-03');
});

test('midnight does not cause a second rollover; selected slate remains until 2 PM',()=>{
 assert.equal(nextResearchSlateDate('2026-11-02T16:00:01Z'),'2026-11-03');
 assert.equal(nextResearchSlateDate('2026-11-03T05:59:59Z'),'2026-11-03');
 assert.equal(nextResearchSlateDate('2026-11-03T06:00:00Z'),'2026-11-04');
});

test('2 PM turnover follows Asia/Manila independently of US daylight saving time',()=>{
 assert.equal(nextResearchSlateDate('2026-11-01T05:59:59Z'),'2026-11-01');
 assert.equal(nextResearchSlateDate('2026-11-01T06:00:00Z'),'2026-11-02');
});
