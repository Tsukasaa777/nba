import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeInjuryFeed,injuryForTeam} from '../src/lib/injury-feed';
const sample = {status:'success',timestamp:'2026-11-02T03:28:48Z',injuries:[
 {displayName:'Detroit Pistons',injuries:[
  {id:'1',status:'Questionable',athlete:{displayName:'Sample Player A'},date:'2026-11-02T03:00Z',details:{type:'Ankle',detail:'Sprain',returnDate:'2026-11-03'}},
  {id:'2',status:'Out',athlete:{displayName:'Sample Player B'},date:'2026-11-01T03:00Z',details:{type:'Knee'}}
 ]},
 {displayName:'Boston Celtics',injuries:[{id:'3',status:'Probable',athlete:{displayName:'Sample Player C'},date:'2026-11-02T03:15Z',details:{type:'Rest'}}]}
]};
test('ESPN injury normalization retains original statuses, source, and timestamps',()=>{
 const x=normalizeInjuryFeed(sample,'2026-11-02T03:40:00Z');
 assert.equal(x.source,'ESPN');assert.equal(x.coverage,'league-wide');
 assert.equal(x.reports.length,3);assert.equal(x.reports[0].status,'Questionable');
 assert.equal(x.reports[0].returnDate,'2026-11-03');
 assert.equal(x.reports[0].detail,'Ankle · Sprain');
 assert.equal(x.publishedAt,'2026-11-02T03:28:48.000Z');
});
test('matchup filtering keeps teams separate and ranks Out before Questionable',()=>{
 const x=normalizeInjuryFeed(sample,'2026-11-02T03:40:00Z');
 assert.deepEqual(injuryForTeam(x.reports,'Detroit Pistons').map(p=>p.player),['Sample Player B','Sample Player A']);
 assert.deepEqual(injuryForTeam(x.reports,'Boston Celtics').map(p=>p.player),['Sample Player C']);
 assert.equal(injuryForTeam(x.reports,'Atlanta Hawks').length,0);
});
test('failure to fetch a recognized injury report never becomes an empty healthy report',()=>{
 assert.throws(()=>normalizeInjuryFeed({status:'fail',injuries:[]},'2026-11-02T03:40:00Z'));
 assert.throws(()=>normalizeInjuryFeed({status:'success'},'2026-11-02T03:40:00Z'));
});
