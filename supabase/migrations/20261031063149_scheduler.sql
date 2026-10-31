grant usage on schema vault to service_role;
grant select on vault.decrypted_secrets to service_role;

select cron.schedule('propspro-nba-sync','*/15 * * * *', $job$
 select net.http_post(
  url:=(select decrypted_secret from vault.decrypted_secrets where name='propspro_project_url' limit 1)||'/functions/v1/sync-nba',
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='propspro_sync_secret' limit 1)),
  body:='{}'::jsonb,timeout_milliseconds:=180000
 );
$job$);
