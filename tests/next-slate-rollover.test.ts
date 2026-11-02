import test from 'node:test';
import assert from 'node:assert/strict';
import {nextResearchSlateDate} from '../src/lib/analytics';

test('default matchup is tomorrow before 2 PM PHT',()=>{
 assert.equal(nextResearchSlateDate('2026-11-02T05:59:59Z'),'2026-11-03');
 assert.equal(nextResearchSlateDate('2026-11-02T00:00:00Z'),'2026-11-03');
});

test('exactly 2 PM PHT advances choices to the following slate',()=>{
 assert.equal(nextResearchSlateDate('2026-11-02T06:00:00Z'),'2026-11-04');
 assert.equal(nextResearchSlateDate('2026-11-02T15:59:59Z'),'2026-11-04');
});

test('local midnight does not cause an extra rollover; only 2 PM does',()=>{
 assert.equal(nextResearchSlateDate('2026-11-02T16:00:01Z'),'2026-11-04');
 assert.equal(nextResearchSlateDate('2026-11-03T05:59:59Z'),'2026-11-04');
 assert.equal(nextResearchSlateDate('2026-11-03T06:00:00Z'),'2026-11-05');
});

test('rollover remains Manila-based and unaffected by US DST',()=>{
 assert.equal(nextResearchSlateDate('2026-11-01T05:59:59Z'),'2026-11-02');
 assert.equal(nextResearchSlateDate('2026-11-01T06:00:00Z'),'2026-11-03');
});
