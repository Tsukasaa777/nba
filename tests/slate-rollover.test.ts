import test from 'node:test';
import assert from 'node:assert/strict';
import {dayBounds,manilaDate,nextResearchSlateDate} from '../src/lib/analytics';

test('Nov 9 afternoon selects Nov 10, without skipping to Nov 11',()=>{
 assert.equal(nextResearchSlateDate('2026-11-09T04:59:59Z'),'2026-11-09'); // 12:59 PM
 assert.equal(nextResearchSlateDate('2026-11-09T05:00:00Z'),'2026-11-10'); // 1 PM
 assert.equal(nextResearchSlateDate('2026-11-09T14:48:00Z'),'2026-11-10'); // 10:48 PM
});
test('Nov 10 slate remains selected overnight until next 1 PM',()=>{
 assert.equal(nextResearchSlateDate('2026-11-09T16:00:00Z'),'2026-11-10');
 assert.equal(nextResearchSlateDate('2026-11-10T04:59:59Z'),'2026-11-10');
 assert.equal(nextResearchSlateDate('2026-11-10T05:00:00Z'),'2026-11-11');
});
test('year boundary advances to New Year on Dec 31 at 1 PM PHT',()=>{
 assert.equal(manilaDate('2026-12-31T04:59:59Z'),'2026-12-31');
 assert.equal(nextResearchSlateDate('2026-12-31T04:59:59Z'),'2026-12-31');
 assert.equal(nextResearchSlateDate('2026-12-31T05:00:00Z'),'2027-01-01');
 assert.equal(nextResearchSlateDate('2026-12-31T16:00:00Z'),'2027-01-01');
});
test('game date bounds remain midnight-to-midnight PHT, independently of the rollover',()=>{
 const bounds=dayBounds('2026-11-10');
 assert.equal(bounds.start,'2026-11-09T16:00:00.000Z');
 assert.equal(bounds.end,'2026-11-10T16:00:00.000Z');
});
