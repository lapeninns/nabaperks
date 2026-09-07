# Disposable populated migration proof

This fixture uses the real Nabaperks billing, membership, stamp, reward and
Stripe webhook tables, with synthetic reserved UUIDs and example.test addresses.
It is not a customer-data export or a full application compatibility test.

Provision a NEW local PostgreSQL database named `codex_upgrade_<run>` with the
Supabase platform schemas/roles/extensions required by repository migrations.
It must contain no public application tables and no auth users. The external
provisioner creates `codex_upgrade_guard.target(marker uuid primary key,
consumed boolean not null default false)` and inserts one fresh UUIDv4 marker.
The harness refuses to create its own marker and consumes it before migration.
Do not point it at an existing local app database. Destroy the whole disposable
database after collecting evidence, including on failure; the runner never
resets or drops a database itself.

Use a clean environment containing PATH and UPGRADE_DATABASE_URL. Provider
credentials and other database connection environment variables are rejected.
Literal 127.0.0.1 or ::1 addresses are required; URL connection overrides are
forbidden. A local address and marker are operational safety checks, not a
security boundary against an operator deliberately tunnelling production.

Run `node scripts/release/populated-upgrade.mjs /absolute/configuration.json`.
Configuration needs repository (absolute Git checkout), baselineRevision,
candidateRevision and rollbackRevision (full available commit SHAs), marker,
and three probes in baseline/candidate/rollback order. Each probe specifies
revision, artifactRoot (absolute directory), manifestPath (absolute JSON file
outside that tree), and manifestDigest (SHA-256 of exact manifest bytes).
The manifest has schema `nabaperks.upgrade-probe.v1`, revision,
databaseAdapter=`upgrade-database-url-only`, treeDigest, and relative paths
runtime (bundled binary), entrypoint (probe script), application (app build),
lockfile, plus args (argument array). `probeTreeDigest()` hashes every relative
file path, permission mode and file contents, including runtime, application,
script and dependencies. The runtime executes the bound entrypoint from the
artifact directory, never from the source checkout. A binary-only pin or
`/usr/bin/env` script wrapper is rejected. Artifact files and ancestor directories
must contain no `.env` or `.env.*` files; symlinks and external argument paths
are refused. Build a dereferenced self-contained artifact rather than pointing
at pnpm workspace symlinks. Tree/manifest hashes are checked before writes and
before/after every probe. Database credentials belong only in
UPGRADE_DATABASE_URL. No services are started automatically.

The runner reads migrations with git show at pinned revisions, refuses changed
baseline migration bytes/order, applies the entire baseline, inserts the fixture,
checks invariants, applies the candidate suffix and checks invariants again.
Each migration runs in one explicit transaction with its Supabase version/name
ledger row and a content SHA-256 audit row. A SQL error aborts that transaction
and produces no applied ledger version. Migrations with explicit top-level
transaction control or psql commands are refused pending separate review.
Every app probe must preserve the complete invariant JSON, including row counts;
a successful SQL exit alone is not accepted.
The baseline must include the durable billing and issued-reward schema. Older
baselines fail rather than silently substituting a toy fixture.

Each required executable must actually run the matching application revision
against the upgraded disposable schema, with billing, loyalty and webhook
contract assertions. The executable receives UPGRADE_DATABASE_URL,
UPGRADE_APP_REVISION, UPGRADE_MIGRATION_DIGEST, UPGRADE_CHALLENGE and
UPGRADE_TARGET_MARKER. Its reviewed database adapter must use only
UPGRADE_DATABASE_URL and assert the marker on that exact connection. Do not
reuse tests/db/helpers/db.mjs, which discovers repository dotenv files and
uses a different environment variable. It must return
only JSON on stdout: revision, migrationDigest, challenge, result="success", and
checks=[{contract:"billing",assertions:N},{contract:"loyalty",assertions:N},
{contract:"webhook",assertions:N}], with positive executed assertion counts.
Diagnostics go to stderr; no credentials or customer information may be emitted.
Probe code must isolate/start/stop its own old/new/rollback app as necessary.
The harness pins the complete artifact and argv but does not infer that a reported count
is a meaningful app test: reviewers must inspect these executable probes and
their pinned application builds. No example no-op success probe is supplied.

Successful output is an execution evidence payload, not an authenticated release
stage manifest or production approval. A trusted release owner must bind it to
its source/build identity, run/attempt, timestamps and publisher. SQL invariants
alone never satisfy old/new/rollback application proof.

## Platform bootstrap plan (not executed by this harness)

Use the repository-pinned Supabase CLI 2.106.0 and PostgreSQL 17 in an isolated
local stack with a unique project ID and unused ports. Initialise the stack in
a separate temporary project containing no application migrations or seeds;
allow its actual platform services to initialise auth/storage schemas. Do not
substitute a handcrafted auth.users table: migration dependencies include
sessions, MFA factors/claims, identities and auth helper functions. The runner
checks those structures, roles and Postgres major before consuming the marker.

Provision the codex_upgrade database from this pristine local platform schema
and its platform migration metadata, using local-only dump/restore or a
provisioner-controlled database template after stopping platform connections.
This is a pristine platform bootstrap, never a production or populated project
snapshot. Verify application tables and auth users are absent, migration ledger
is empty, and then create the external disposable marker. Start any required
PostgREST/Auth endpoints explicitly against this named disposable database on
isolated ports, with only local synthetic keys; provide their local adapters in
the reviewed probe artifact. Pin and record the actual Supabase image/CLI
versions and bootstrap digest in the provisioner's evidence. Capture execution
logs and tear down this entire isolated stack/database on success or failure.
This plan needs service-backed qualification before operational use.

Artifact hashing detects drift; it is not a sandbox or proof that arbitrary
probe code cannot open an external file or network connection. Run probes in the
independently qualified disposable execution environment and review their DB
adapters and immutable build provenance. No probe API assertion counts or
manifest strings establish those trust properties by themselves.

## Reviewed domain probe artifact builder

`build-probe.mjs` builds the supplied probe against a clean, exact application
source commit. It exports committed source to a fresh temporary checkout and
installs its pinned pnpm lockfile into a fresh isolated package store with
integrity verification and lifecycle scripts disabled. Original ignored
node_modules are never used by the qualification builder. Registry access and
the exact pinned pnpm version are required. Invoke it with a JSON configuration containing absolute source and output
paths, the full revision, runtimePath pointing to a Node 24 binary for the
execution machine, and runtimeDigest pinning that binary's SHA-256. Output must
not exist. Run independently for baseline, candidate and rollback commits:

```sh
node tests/fixtures/release-upgrade/build-probe.mjs /absolute/build-config.json
```

The builder emits each probe configuration needed by populated-upgrade.mjs. It
bundles the actual application implementations of billing snapshot application,
webhook lease lifecycle, reward scan token creation and loyalty availability,
along with their imported source/dependencies. Build evidence records the clean
Git source-tree identity, input file digests and compiler version; the runtime,
compiled bundle, lockfile and build evidence are all in the artifact tree.
The builder records fresh-install policy, lockfile and install-log digests,
compiler version and actual compiled dependency bytes. The temporary checkout
and package store are removed after compilation, including on failure. The
low-level compile helper used by unit tests is only a compile check and never
emits a qualified artifact manifest.

The explicit SQL adapter replaces only the Supabase RPC HTTP transport seam.
Application functions retain their real RPC names, named parameter mappings,
response parsing and error handling. The adapter invokes those real database
functions on the exact marker-checked connection, with a service-role request
context. It never discovers dotenv files or falls back to SUPABASE_DB_URL.
All probe state changes occur inside a transaction that always rolls back.
Nested savepoints permit meaningful rejection assertions without aborting the
remaining probe. Successful assertion counts are generated as assertions run.

The domain probe proves:

- The actual billing application maps provider status and applies a coherent
  snapshot through its real database RPC; a stale update token is rejected.
- The actual loyalty availability function reads the seeded context, and the
  real reward token application/RPC creates a token linked to the correct
  customer/reward while rejecting another customer. Synthetic profile setup is
  limited to the reserved fixture ID and is rolled back.
- The actual webhook application/RPC claims a new synthetic event, rejects a
  concurrent claim as busy, records failure, reclaims with incremented attempt,
  completes it and recognises the processed duplicate.

This is authenticated database execution of selected application domain paths,
not an entire Next.js server, browser journey, PostgREST transport, live Stripe
signature verification, external notification or production deployment proof.
The output labels its scope `application-domain-functions-and-real-database-rpcs`.
Build/compile checks without a running disposable database are not service
qualification. A candidate checkout with uncommitted work cannot generate a
qualified full-SHA artifact; commit and independently review it first.
