import test from 'node:test';
import assert from 'node:assert/strict';
import {dayBounds,manilaDate,nextResearchSlateDate} from '../src/lib/analytics';

test('Nov 9 at 10:48 PM PHT chooses Nov 10, never Nov 11',()=>{
 assert.equal(nextResearchSlateDate('2026-11-09T14:48:00Z'),'2026-11-10');
});
test('2 PM Manila is the precise next-slate rollover boundary',()=>{
 assert.equal(nextResearchSlateDate('2026-11-09T05:59:59Z'),'2026-11-09');
 assert.equal(nextResearchSlateDate('2026-11-09T06:00:00Z'),'2026-11-10');
 assert.equal(nextResearchSlateDate('2026-11-09T15:59:59Z'),'2026-11-10');
 assert.equal(nextResearchSlateDate('2026-11-10T05:59:59Z'),'2026-11-10');
 assert.equal(nextResearchSlateDate('2026-11-10T06:00:00Z'),'2026-11-11');
});
test('calendar boundaries respect Asia/Manila rather than UTC midnight',()=>{
 assert.equal(manilaDate('2026-11-09T20:30:00Z'),'2026-11-10');
 assert.equal(nextResearchSlateDate('2026-11-09T20:30:00Z'),'2026-11-10');
 assert.equal(nextResearchSlateDate('2026-12-31T06:00:00Z'),'2027-01-01');
});
test('upcoming game date window remains exactly midnight-to-midnight Philippine time',()=>{
 const bounds=dayBounds('2026-11-10');
 assert.equal(bounds.start,'2026-11-09T16:00:00.000Z');
 assert.equal(bounds.end,'2026-11-10T16:00:00.000Z');
});
