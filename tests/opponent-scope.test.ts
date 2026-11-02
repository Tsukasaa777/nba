import test from 'node:test';
import assert from 'node:assert/strict';
import { qualifying } from '../src/lib/analytics';
import type { BoxScore } from '../src/lib/types';

const make = (id:number, opponent:string, pts:number):BoxScore => ({
  game_id:'sportapi:'+id,player_id:'sportapi:468',team_id:'sportapi:25',played:true,minutes:30,
  stats:{pts,reb:6,ast:3,fg3m:2},fetched_at:'2026-10-30T00:00:00Z',
  game:{id:'sportapi:'+id,provider_date:'2026-10-'+id,starts_at:'2026-10-'+id+'T23:00:00Z',
    status:'final',season:2026,source:'SportAPI',fetched_at:'2026-10-31T00:00:00Z',
    home_team_id:'sportapi:25',away_team_id:opponent,home_score:105,away_score:101,postseason:false,
    home_team:{id:'sportapi:25',name:'Toronto Raptors',abbreviation:'TOR'},
    away_team:{id:opponent,name:'Test Opponent',abbreviation:'OPP'}}
});

test('L5/L10 default to ALL opponents when opponent filter absent',()=>{
  const games=[make(21,'sportapi:10',20),make(23,'sportapi:15',25),make(25,'sportapi:19',30)];
  assert.deepEqual(qualifying(games,'pts',{window:10}).map(r=>r.game_id),
    ['sportapi:25','sportapi:23','sportapi:21']);
  assert.equal(qualifying(games,'pts',{window:5}).length,3);
});

test('Only an explicit H2H opponent filter limits past games',()=>{
  const games=[make(21,'sportapi:10',20),make(23,'sportapi:15',25),make(25,'sportapi:10',30)];
  assert.deepEqual(qualifying(games,'pts',{window:10,opponent:'sportapi:10'}).map(r=>r.game_id),
    ['sportapi:25','sportapi:21']);
});
