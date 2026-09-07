# Pristine Supabase platform for populated upgrade proof

`provision-platform.mjs` runs **inside an isolated Linux CI job** sharing the
network namespace of its own disposable DinD sidecar. The sole operational
owner creates that job, preloads the verified image archive and owns its final
outer teardown. This script does not create or resume a Mac agent, Lima VM,
host Docker service or another project's containers.

The script requires `DOCKER_HOST=tcp://127.0.0.1:2375`, an initially empty
container and volume inventory, Supabase CLI 2.106.0 and every image identity in
`config/local-ci-image-manifest.json`. The operator must supply an independently
generated UUIDv4 marker. A fresh project and target database name derive from
that marker; an existing daemon workload is rejected before any cleanup.
Loopback is an operational boundary inside the approved job, not independent
proof that an arbitrary Docker daemon is disposable.

## Bootstrap and target

The temporary project contains only a generated minimal config. Application
migrations and seeds are disabled; no repository migrations, seed, dotenv,
project-ref or credential files enter this project. Auth and Storage are enabled
so the pinned CLI initializes their genuine service schemas. Unneeded running
services are excluded. CLI initialization invokes the authentic service
migration images; it does not replace Auth/MFA tables with test stubs.

After the blank platform passes read-only checks, only this project's service
containers are stopped. The provisioner connects to `template1`, disables new
connections to its own blank `postgres`, terminates existing connections to
that database and clones it into `codex_upgrade_<marker_without_hyphens>`.
This preserves platform tables, functions, ownership and migrations without
copying application or customer data. Connections to `postgres` are then
restored. `cron.database_name` and `pg_net.database_name` are set to the new
database and only this project's database container is restarted. Both settings
are read back before the target is admitted.

The target must be PostgreSQL 17, contain zero public application tables and
zero auth users, contain genuine Auth/MFA/session/identity objects, and retain
the expected Supabase roles. Both pg_cron and pg_net must be available. A schema
only dump is hashed as the bootstrap digest. The external marker is inserted
into `codex_upgrade_guard.target` with `consumed=false`; the upgrade harness
atomically consumes it before applying repository migrations.

The clone is not a backup or production restoration. It is an authentic blank
platform within this one disposable cluster. Background scheduling and HTTP
provider delivery are not validated by extension availability or config
readback.

## Invocation inside the approved job

Prepare a mode-0600 configuration file containing:

```json
{
  "marker": "<independently generated UUIDv4>",
  "port": 54322,
  "upgradeConfigPath": "/absolute/path/to/upgrade-config.json",
  "evidencePath": "/absolute/new/path/platform-and-upgrade-evidence.json"
}
```

`upgradeConfigPath` points to the existing populated-upgrade configuration with
exact baseline/candidate/rollback revisions and independently reviewed probe
artifact pins. The provisioner supplies its own database URL and marker.

Run from the qualified source checkout:

```sh
node tests/fixtures/release-upgrade/provision-platform.mjs /absolute/path/to/platform-config.json
```

No password, Supabase status output or provider key is printed. The temporary
target JSON and harness configuration are mode 0600 under a fresh temporary
directory. The callback runs with the explicit target URL and restricted
environment. Successful evidence contains versions, image/config/bootstrap
hashes, read-only platform facts and the harness result. The terminal returns
only the evidence path and success status. Evidence is written only after
scoped teardown succeeds.

Every subprocess has a deadline. Cancellation terminates its process group;
cleanup runs separately with a bounded deadline. Success, startup failure,
bootstrap refusal, callback exception and cancellation all run
`supabase stop --project-id <this_project> --no-backup`; `--all` is never used.
Temporary files are removed in `finally`. A teardown failure fails the overall
operation and still requires the outer job/sidecar owner to remove its resources.
SIGKILL or machine loss cannot execute JavaScript cleanup; the independent
outer disposable-runtime owner remains responsible for those failure cases.

## Real migration failure injection

The exported `withPristinePlatform(options, operation)` API keeps the target
alive only while `operation` runs. For the operational failure-injection proof,
run the genuine populated-upgrade harness in that callback, then use its
`databaseUrl` in a restricted `PGDATABASE` environment to execute the real
`transactionalMigration` output for a reserved synthetic migration:

1. Verify `public.codex_upgrade_failure_probe` is absent and reserve an unused
   14-digit migration version, distinct from every source migration.
2. Generate the transaction using `transactionalMigration` with SQL that creates
   this one table and then executes `select 1 / 0;`.
3. Execute with `psql -X -qAt -v ON_ERROR_STOP=1 -v VERBOSITY=verbose` on the exact
   supplied disposable URL. Require psql exit code 3 and SQLSTATE 22012; a
   connection failure or unrelated error is not a successful injection.
4. Reconnect and prove the table is absent and the reserved version has no row
   in either `supabase_migrations.schema_migrations` or
   `codex_upgrade_guard.migrations`. Repeat the fixture invariants.
5. Retain only sanitized SQLSTATE, exact revision/version, assertion outcomes
   and duration evidence, then return so the scoped teardown runs.

This service-backed injection is separate from the offline lifecycle tests. Do
not label it passed from generated SQL, mocked commands or a successful platform
bootstrap. No live platform or failure-injection result is claimed by this
source implementation.

## Reviewed references

The exact CLI source revision pinned by the image manifest initializes service
schemas in [Supabase CLI database startup](https://github.com/supabase/cli/blob/bd39bcf5e613be87943f8bb8fe4ce75c8dfd84de/apps/cli-go/internal/db/start/start.go).
Local CLI help verified the used `start --workdir --exclude`, `status -o json`
and `stop --project-id --no-backup --workdir` flags.
The extension maintainers document database selection and reload/restart
requirements for [pg_net](https://github.com/supabase/pg_net#installation) and
[pg_cron](https://github.com/citusdata/pg_cron#setting-up-pg_cron).
Actual clone, platform image behavior and the complete migration chain remain
operational qualification requirements.
