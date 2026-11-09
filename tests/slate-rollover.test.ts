import test from 'node:test';
import assert from 'node:assert/strict';
import {dayBounds,manilaDate,nextResearchSlateDate} from '../src/lib/analytics';

test('Nov 9 at 10:48 PM PHT stays Nov 9, then advances at midnight',()=>{
 assert.equal(nextResearchSlateDate('2026-11-09T14:48:00Z'),'2026-11-09');
 assert.equal(nextResearchSlateDate('2026-11-09T15:59:59Z'),'2026-11-09');
 assert.equal(nextResearchSlateDate('2026-11-09T16:00:00Z'),'2026-11-10');
});
test('no premature rollover at 2 PM PHT or later in the afternoon',()=>{
 assert.equal(nextResearchSlateDate('2026-11-10T05:59:59Z'),'2026-11-10');
 assert.equal(nextResearchSlateDate('2026-11-10T06:00:00Z'),'2026-11-10');
 assert.equal(nextResearchSlateDate('2026-11-10T15:59:59Z'),'2026-11-10');
 assert.equal(nextResearchSlateDate('2026-11-10T16:00:00Z'),'2026-11-11');
});
test('calendar boundaries respect Asia/Manila rather than UTC midnight',()=>{
 assert.equal(manilaDate('2026-11-09T20:30:00Z'),'2026-11-10');
 assert.equal(nextResearchSlateDate('2026-11-09T20:30:00Z'),'2026-11-10');
 assert.equal(nextResearchSlateDate('2026-12-31T15:59:59Z'),'2026-12-31');
 assert.equal(nextResearchSlateDate('2026-12-31T16:00:00Z'),'2027-01-01');
});
test('upcoming game date window remains exactly midnight-to-midnight Philippine time',()=>{
 const bounds=dayBounds('2026-11-10');
 assert.equal(bounds.start,'2026-11-09T16:00:00.000Z');
 assert.equal(bounds.end,'2026-11-10T16:00:00.000Z');
});
