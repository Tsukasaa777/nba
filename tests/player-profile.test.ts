import test from 'node:test';
import assert from 'node:assert/strict';
import {findVerifiedRosterPlayer,extractUpcomingTeamGames,espnAbbreviation} from '../src/lib/player-profile';
import type {Team} from '../src/lib/types';

const team:Team={id:'sportapi:30',name:'Boston Celtics',abbreviation:'BOS'};
test('verifies exact athlete name in roster before displaying headshot',()=>{
 const data={athletes:[
  {id:'1',displayName:'Jayson Tatum',headshot:{href:'https://a.espncdn.com/i/headshots/nba/players/full/4065648.png'},jersey:'0',position:{abbreviation:'F'}},
  {id:'2',displayName:'Jason Tatum',headshot:{href:'https://unknown.example/1.jpg'}}
 ]};
 const found=findVerifiedRosterPlayer(data,'Jayson Tatum');
 assert.ok(found);assert.equal(found.headshot,'https://a.espncdn.com/i/headshots/nba/players/full/4065648.png');
 assert.equal(found.jersey,'0');
 assert.equal(findVerifiedRosterPlayer(data,'Jaylen Brown'),null);
});
test('never display untrusted URL or ambiguous name portraits',()=>{
 const bad={athletes:[{displayName:'Jayson Tatum',headshot:{href:'https://scam.test/portrait.png'}},
  {displayName:'Jayson Tatum',headshot:{href:'https://a.espncdn.com/i/headshots/nba/players/full/123.png'}}]};
 assert.equal(findVerifiedRosterPlayer(bad,'Jayson Tatum'),null);
 const single={athletes:bad.athletes.slice(0,1)};
 assert.equal(findVerifiedRosterPlayer(single,'Jayson Tatum')?.headshot,null);
});
test('upcoming games are real scheduled team games and use correct venue',()=>{
 const data={events:[
  {id:'old',date:'2026-11-01T00:00:00Z',competitions:[{competitors:[]}]},
  {id:'upcoming1',date:'2026-11-07T00:00:00Z',competitions:[{competitors:[
   {homeAway:'home',team:{displayName:'Charlotte Hornets',abbreviation:'CHA'}},
   {homeAway:'away',team:{displayName:'Boston Celtics',abbreviation:'BOS'}}
  ]}]},
  {id:'upcoming2',date:'2026-11-09T01:00:00Z',competitions:[{competitors:[
   {homeAway:'away',team:{displayName:'Milwaukee Bucks',abbreviation:'MIL'}},
   {homeAway:'home',team:{displayName:'Boston Celtics',abbreviation:'BOS'}}
  ]}]},
  {id:'different',date:'2026-11-12T00:00:00Z',competitions:[{competitors:[
   {homeAway:'home',team:{displayName:'New York Knicks',abbreviation:'NYK'}},
   {homeAway:'away',team:{displayName:'Brooklyn Nets',abbreviation:'BKN'}}
  ]}]}
 ]};
 const upcoming=extractUpcomingTeamGames(data,team,'2026-11-05T10:00:00Z');
 assert.equal(upcoming.length,2);
 assert.equal(upcoming[0].venue,'Away');
 assert.equal(upcoming[0].opponentAbbreviation,'CHA');
 assert.equal(upcoming[1].venue,'Home');
 assert.equal(upcoming[1].opponentAbbreviation,'MIL');
});
test('unsupported team abbreviation cannot be sent as a remote route',()=>{
 assert.equal(espnAbbreviation('../../bad'),null);
 assert.equal(espnAbbreviation('BOS'),'bos');
 assert.equal(espnAbbreviation('GSW'),'gs');
});
