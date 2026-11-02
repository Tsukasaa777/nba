-- SportAPI is the documented free NBA box-score provider. Do not rewrite historical IDs.
alter table public.games alter column source set default 'SportAPI';
alter table public.injuries alter column source set default 'SportAPI';
update public.data_health set source='SportAPI',
  message='SportAPI adapter prepared. Awaiting authorized SPORTAPI_API_KEY in Supabase Edge Function secrets.'
where id='nba' and state='awaiting_provider';
