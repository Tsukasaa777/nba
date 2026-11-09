import test from 'node:test';
import assert from 'node:assert/strict';
import {nextResearchSlateDate} from '../src/lib/analytics';

test('PHT day stays selected from midnight until 11:59 PM',()=>{
 assert.equal(nextResearchSlateDate('2026-11-02T00:00:00Z'),'2026-11-02'); // 8 AM
 assert.equal(nextResearchSlateDate('2026-11-02T05:59:59Z'),'2026-11-02'); // 1:59 PM
 assert.equal(nextResearchSlateDate('2026-11-02T06:00:00Z'),'2026-11-02'); // 2 PM: no reset
 assert.equal(nextResearchSlateDate('2026-11-02T15:59:59Z'),'2026-11-02'); // 11:59 PM
});

test('NBA slate advances once at Philippine midnight',()=>{
 assert.equal(nextResearchSlateDate('2026-11-02T15:59:59Z'),'2026-11-02');
 assert.equal(nextResearchSlateDate('2026-11-02T16:00:00Z'),'2026-11-03');
 assert.equal(nextResearchSlateDate('2026-11-03T05:59:59Z'),'2026-11-03');
 assert.equal(nextResearchSlateDate('2026-11-03T06:00:00Z'),'2026-11-03');
});

test('PHT day is independent of US daylight saving transitions',()=>{
 assert.equal(nextResearchSlateDate('2026-11-01T05:59:59Z'),'2026-11-01');
 assert.equal(nextResearchSlateDate('2026-11-01T06:00:00Z'),'2026-11-01');
 assert.equal(nextResearchSlateDate('2026-11-01T16:00:00Z'),'2026-11-02');
});
