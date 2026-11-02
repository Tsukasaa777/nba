create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create table public.teams(id text primary key, name text not null, abbreviation text not null, conference text, fetched_at timestamptz not null default now());
create table public.players(id text primary key, name text not null, position text, team_id text references public.teams(id), active boolean not null default false, fetched_at timestamptz not null default now());
create index players_team_idx on public.players(team_id);
create index players_search_idx on public.players(lower(name));
create table public.games(id text primary key, provider_date date not null, starts_at timestamptz, season integer not null, status text not null check(status in ('scheduled','live','final','postponed','canceled','unknown')), home_team_id text not null references public.teams(id), away_team_id text not null references public.teams(id), home_score integer check(home_score>=0), away_score integer check(away_score>=0), postseason boolean not null default false, source text not null default 'BALLDONTLIE', fetched_at timestamptz not null default now(), check(home_team_id<>away_team_id));
create index games_start_idx on public.games(starts_at);
create index games_date_idx on public.games(provider_date);
create index games_home_idx on public.games(home_team_id,starts_at desc);
create index games_away_idx on public.games(away_team_id,starts_at desc);
create table public.box_scores(game_id text not null references public.games(id), player_id text not null references public.players(id), team_id text not null references public.teams(id), played_at timestamptz not null, minutes numeric check(minutes>=0 and minutes<=80), played boolean not null, stats jsonb not null, fetched_at timestamptz not null default now(), primary key(game_id,player_id));
create index boxes_player_date_idx on public.box_scores(player_id,played_at desc);
create index boxes_team_idx on public.box_scores(team_id,played_at desc);
create table public.injuries(player_id text primary key references public.players(id), status text not null, detail text, return_date text, active boolean not null default true, source text not null default 'BALLDONTLIE', fetched_at timestamptz not null default now());
create table public.data_health(id text primary key, state text not null default 'awaiting_provider', last_attempt timestamptz, last_success timestamptz, stats_success timestamptz, injuries_success timestamptz, roster_success timestamptz, message text, backfill_cursor date, source text not null default 'BALLDONTLIE', schedule text not null default 'Every 15 minutes');
insert into public.data_health(id,message) values('nba','Awaiting an authorized NBA API key. No live data has been verified.');

create table private.sync_runs(id uuid primary key, started_at timestamptz not null default now(), finished_at timestamptz, state text not null, message text, counts jsonb);
create table private.sync_lock(id text primary key, owner uuid, expires_at timestamptz);
insert into private.sync_lock(id) values('nba');
create table private.projection_snapshots(id uuid primary key default gen_random_uuid(), game_id text not null references public.games(id), player_id text not null references public.players(id), market text not null, created_at timestamptz not null default now(), model_version text not null, inputs_as_of timestamptz not null, snapshot jsonb not null, stale boolean not null default false);
create index snapshots_game_idx on private.projection_snapshots(game_id);
create index snapshots_player_idx on private.projection_snapshots(player_id);

create table public.research_picks(id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now(), snapshot jsonb not null check(jsonb_typeof(snapshot)='object' and octet_length(snapshot::text)<20000));
create index research_owner_date_idx on public.research_picks(user_id,created_at desc);

do $$ declare t text; begin
 foreach t in array array['teams','players','games','box_scores','injuries','data_health'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('grant select on public.%I to anon, authenticated',t);
  execute format('revoke insert,update,delete on public.%I from anon,authenticated',t);
  execute format('create policy public_read on public.%I for select to anon,authenticated using(true)',t);
 end loop;
end $$;
alter table public.research_picks enable row level security;
grant select,insert,delete on public.research_picks to authenticated;
revoke all on public.research_picks from anon;
revoke update on public.research_picks from authenticated;
create policy own_select on public.research_picks for select to authenticated using((select auth.uid())=user_id);
create policy own_insert on public.research_picks for insert to authenticated with check((select auth.uid())=user_id);
create policy own_delete on public.research_picks for delete to authenticated using((select auth.uid())=user_id);
alter table private.sync_runs enable row level security;
alter table private.sync_lock enable row level security;
alter table private.projection_snapshots enable row level security;
grant usage on schema private to service_role;
grant all on all tables in schema private to service_role;
grant all on all tables in schema public to service_role;

-- Scheduler authentication stays in Vault and is never returned to clients.
select vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'propspro_sync_secret');

create function public.claim_nba_sync(p_token text,p_owner uuid) returns boolean
language plpgsql security invoker set search_path='' as $$
declare expected text; acquired boolean;
begin
 select decrypted_secret into expected from vault.decrypted_secrets where name='propspro_sync_secret' limit 1;
 if expected is null or extensions.digest(coalesce(p_token,''),'sha256')<>extensions.digest(expected,'sha256') then return false; end if;
 update private.sync_lock set owner=p_owner,expires_at=now()+interval '6 minutes' where id='nba' and (expires_at is null or expires_at<now());
 acquired=found;
 if acquired then
  insert into private.sync_runs(id,state) values(p_owner,'running');
  update public.data_health set last_attempt=now() where id='nba';
 end if;
 return acquired;
end $$;
revoke execute on function public.claim_nba_sync(text,uuid) from public,anon,authenticated;
grant execute on function public.claim_nba_sync(text,uuid) to service_role;

create function public.finish_nba_sync(p_owner uuid,p_state text,p_message text,p_counts jsonb,p_stats boolean default false,p_injuries boolean default false,p_roster boolean default false,p_cursor date default null) returns void
language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from private.sync_lock where id='nba' and owner=p_owner and expires_at>now()) then raise exception 'Sync lease expired'; end if;
 update private.sync_runs set finished_at=now(),state=p_state,message=p_message,counts=p_counts where id=p_owner;
 update public.data_health set state=p_state,message=p_message,
 last_success=case when p_state in ('current','partial') then now() else last_success end,
 stats_success=case when p_stats then now() else stats_success end,
 injuries_success=case when p_injuries then now() else injuries_success end,
 roster_success=case when p_roster then now() else roster_success end,
 backfill_cursor=coalesce(p_cursor,backfill_cursor) where id='nba';
 update private.sync_lock set owner=null,expires_at=null where id='nba' and owner=p_owner;
 delete from private.sync_runs where started_at<now()-interval '30 days';
end $$;
revoke execute on function public.finish_nba_sync(uuid,text,text,jsonb,boolean,boolean,boolean,date) from public,anon,authenticated;
grant execute on function public.finish_nba_sync(uuid,text,text,jsonb,boolean,boolean,boolean,date) to service_role;

-- Every page is atomic. A failed write cannot advance a backfill cursor.
create function public.ingest_nba_batch(p_owner uuid,p_payload jsonb) returns void
language plpgsql security invoker set search_path='' as $$
declare r jsonb;
begin
 if not exists(select 1 from private.sync_lock where id='nba' and owner=p_owner and expires_at>now()) then raise exception 'Sync lease expired'; end if;
 for r in select value from jsonb_array_elements(coalesce(p_payload->'teams','[]')) loop
  insert into public.teams(id,name,abbreviation,conference) values(r->>'id',r->>'name',r->>'abbreviation',r->>'conference')
  on conflict(id) do update set name=excluded.name,abbreviation=excluded.abbreviation,conference=excluded.conference,fetched_at=now();
 end loop;
 for r in select value from jsonb_array_elements(coalesce(p_payload->'players','[]')) loop
  insert into public.players(id,name,position,team_id,active) values(r->>'id',r->>'name',r->>'position',r->>'team_id',coalesce((r->>'active')::boolean,false))
  on conflict(id) do update set name=excluded.name,position=excluded.position,team_id=case when r?'active' then excluded.team_id else players.team_id end,active=case when r?'active' then excluded.active else players.active end,fetched_at=now();
 end loop;
 for r in select value from jsonb_array_elements(coalesce(p_payload->'games','[]')) loop
  insert into public.games(id,provider_date,starts_at,season,status,home_team_id,away_team_id,home_score,away_score,postseason)
  values(r->>'id',(r->>'provider_date')::date,(r->>'starts_at')::timestamptz,(r->>'season')::integer,r->>'status',r->>'home_team_id',r->>'away_team_id',(r->>'home_score')::integer,(r->>'away_score')::integer,coalesce((r->>'postseason')::boolean,false))
  on conflict(id) do update set provider_date=excluded.provider_date,starts_at=coalesce(excluded.starts_at,games.starts_at),status=excluded.status,home_score=excluded.home_score,away_score=excluded.away_score,fetched_at=now();
 end loop;
 for r in select value from jsonb_array_elements(coalesce(p_payload->'boxes','[]')) loop
  insert into public.box_scores(game_id,player_id,team_id,played_at,minutes,played,stats)
  values(r->>'game_id',r->>'player_id',r->>'team_id',(r->>'played_at')::timestamptz,(r->>'minutes')::numeric,(r->>'played')::boolean,r->'stats')
  on conflict(game_id,player_id) do update set team_id=excluded.team_id,played_at=excluded.played_at,minutes=excluded.minutes,played=excluded.played,stats=excluded.stats,fetched_at=now();
 end loop;
 if p_payload?'injuries' then
  update public.injuries set active=false;
  for r in select value from jsonb_array_elements(p_payload->'injuries') loop
   insert into public.injuries(player_id,status,detail,return_date) values(r->>'player_id',r->>'status',r->>'detail',r->>'return_date')
   on conflict(player_id) do update set status=excluded.status,detail=excluded.detail,return_date=excluded.return_date,active=true,fetched_at=now();
  end loop;
  update private.projection_snapshots set stale=true where game_id in(select id from public.games where status='scheduled');
 end if;
end $$;
revoke execute on function public.ingest_nba_batch(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.ingest_nba_batch(uuid,jsonb) to service_role;

-- Schedule is installed separately after the Edge Function is deployed.
