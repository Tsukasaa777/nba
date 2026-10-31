create policy service_worker_only on private.sync_runs for all to service_role using(true) with check(true);
create policy service_worker_only on private.sync_lock for all to service_role using(true) with check(true);
create policy service_worker_only on private.projection_snapshots for all to service_role using(true) with check(true);
