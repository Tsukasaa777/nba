-- Run against the project as postgres. All fixtures and log changes roll back.
begin;
do $$
declare owner uuid:=gen_random_uuid(); token text; payload jsonb; amount integer;
begin
 select decrypted_secret into token from vault.decrypted_secrets where name='propspro_sync_secret' limit 1;
 if public.claim_nba_sync('invalid',owner) then raise exception 'Invalid token acquired lock'; end if;
 if not public.claim_nba_sync(token,owner) then raise exception 'Valid scheduler token failed'; end if;
 if public.claim_nba_sync(token,gen_random_uuid()) then raise exception 'Overlapping job acquired lock'; end if;
 payload:='{"teams":[{"id":"fixture:h","name":"ISOLATED TEST HOME","abbreviation":"TH"},{"id":"fixture:a","name":"ISOLATED TEST AWAY","abbreviation":"TA"}],"players":[{"id":"fixture:p","name":"ISOLATED TEST PLAYER","position":"G"}],"games":[{"id":"fixture:g","provider_date":"2026-01-01","starts_at":"2026-01-01T23:00:00Z","season":2025,"status":"final","home_team_id":"fixture:h","away_team_id":"fixture:a","home_score":100,"away_score":90}],"boxes":[{"game_id":"fixture:g","player_id":"fixture:p","team_id":"fixture:h","played_at":"2026-01-01T23:00:00Z","minutes":30,"played":true,"stats":{"pts":20,"reb":null,"ast":5}}]}'::jsonb;
 perform public.ingest_nba_batch(owner,payload);
 perform public.ingest_nba_batch(owner,payload);
 select count(*) into amount from public.box_scores where game_id='fixture:g';
 if amount<>1 then raise exception 'Upsert duplicated box score'; end if;
 payload:=jsonb_set(payload,'{boxes,0,stats,pts}','31');
 perform public.ingest_nba_batch(owner,payload);
 if(select (stats->>'pts')::integer from public.box_scores where game_id='fixture:g')<>31 then raise exception 'Correction not applied';end if;
 if(select stats->'reb' from public.box_scores where game_id='fixture:g')<>'null'::jsonb then raise exception 'Missing value was changed';end if;
 begin
  perform public.ingest_nba_batch(owner,jsonb_set(payload,'{boxes,0,player_id}','"nonexistent"'));
  raise exception 'Missing foreign key was accepted';
 exception when foreign_key_violation then null;
 end;
 perform public.finish_nba_sync(owner,'current','ISOLATED ROLLBACK TEST','{}'::jsonb,true,false,false,null);
 if exists(select 1 from private.sync_lock l where l.id='nba' and l.owner is not null) then raise exception 'Lock was not released';end if;
end $$;
select 'PASS: authentication, overlapping-job lock, idempotent upsert, corrections, null preservation, foreign-key validation, lock release' as database_test;
rollback;
