-- SportAPI's credential is encrypted in Supabase Vault, never in client code.
-- Configure Vault secret named sportapi_api_key using project administration.
create or replace function public.get_sportapi_provider_key()
returns text language sql security invoker set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets
  where name = 'sportapi_api_key' limit 1;
$$;
revoke all on function public.get_sportapi_provider_key() from public, anon, authenticated;
grant execute on function public.get_sportapi_provider_key() to service_role;

alter table public.games alter column source set default 'SportAPI';
update public.data_health set source='SportAPI',
  message='SportAPI adapter enabled; data sync verifies credentials and refresh status.'
where id='nba' and state='awaiting_provider';
