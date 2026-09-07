# Independent production monitor

The standalone runner at `ops/monitoring/independent-monitor.mjs` observes
production without GitHub APIs or the production Supabase alert receiver. This
is implemented source, not an installed scheduler or demonstrated notification
channel. Existing GitHub smoke/watchdog controls remain separate.

## Independently provisioned runtime

Deploy a reviewed immutable copy of the runner, its imports and configuration
contracts to a separate operational host. Provision its scheduler, runtime,
persistent filesystem and paging receiver outside GitHub and the monitored
production Supabase project's failure domains. The dependency inventory must
cover runtime, state, DNS, secrets and delivery prerequisites; declaring a
different provider name cannot establish independence by itself.

Copy `ops/monitoring/config.example.json` to a protected runtime configuration
file outside the source checkout. Replace every placeholder and complete each
reviewed dependency inventory. The example deliberately fails closed. Supply a
public HTTPS receiver that implements the protocol below and bind its hostname
in the paging inventory. GitHub, Supabase and the monitored application domains
are refused as receiver hosts. Keep the production origin as
`https://nabaperks.com`; optionally pin a 12- or 40-character production revision.

The independent secret store supplies these process environment values:

- `INDEPENDENT_MONITOR_CONFIG_SHA256`: independently reviewed SHA-256 of exact
  runtime configuration bytes. A configuration change requires deliberate state
  migration and new review; changing this pin alone cannot reuse old state.
- `INDEPENDENT_MONITOR_SECRET`: the production readiness bearer credential.
- `INDEPENDENT_WEBHOOK_SECRET`: a separate receiver HMAC signing credential.

Both credentials must be at least 32 characters. Keep their values out of
configuration files, repository files, command arguments and retained output.
This runner does not provision or rotate credentials and does not need Supabase
database credentials, GitHub tokens or production notification-provider keys.

Provision the parent of the configured state directory on an independent
persistent local filesystem with POSIX atomic rename/fsync support. Do not use
ephemeral serverless storage or a filesystem mounted from a monitored service.
Run once with `--init` under the dedicated runtime user:

```bash
node ops/monitoring/independent-monitor.mjs /protected/monitor.json --init
```

Initialisation creates a new private directory and durable initial state, makes
no network requests, and refuses an existing directory. Never initialise over
lost or existing incident state. Restore or reconcile state through an operator
recovery instead of silently clearing deduplication history.

Configure the independent scheduler to execute this command every configured
60–300 seconds, with a 150-second process timeout and no overlapping processes:

```bash
node ops/monitoring/independent-monitor.mjs /protected/monitor.json
```

No scheduler has been installed by adding this source. The scheduler must
independently surface missed executions, stale locks and runner failures. A
monitor cannot report its own stopped host or lost scheduler. Rehearse that
separate failure path before claiming monitoring coverage.

## Observation and durable incidents

Each invocation reads `/api/health` and authenticated `/api/readiness` with
redirects disabled and ten-second request timeouts. It verifies production
service/scope/status/environment/revision/time, database and operational status,
the expected numeric readiness signals and seven cron records. Both response
timestamps must be no more than 30 seconds old and at most five seconds ahead
of the independent host's clock. This freshness window is shorter than the
minimum recovery-observation spacing, so replaying one cached response cannot
establish both recovery observations. Maintain host clock synchronisation;
invalid clocks or stale/future responses fail the observation. Reports expose
`lastObservedAt` from the durable state. The shared SLO
contract enforces three-second liveness and five-second readiness latency. The
bearer credential is sent only to the readiness endpoint. HTTP bodies, customer
data and error details are never copied into alert payloads.

The first failure durably opens an incident and queues one trigger event.
Repeated failures reuse that incident without new trigger events. Recovery
requires two healthy observations separated by 80–200% of the configured
cadence; rapid repeated manual invocations and large scheduler gaps cannot
manufacture a recovery streak. An intervening failure resets the streak.

State and pending events are written with private permissions, file fsync,
atomic rename and directory fsync before transmission. A directory lock prevents
concurrent runs. A crash leaves a lock deliberately: first establish that no
process still owns the run, inspect durable state, and only then remove that
specific stale `run.lock` directory. Never remove a live lock or overwrite
`state.json` to obtain a healthy result.

Each invocation attempts at most three queued events, keeping the worst-case
request budget within the scheduler timeout. A remaining backlog exits with an
execution failure and stays durable for the next invocation.
The persistent outbox preserves historical trigger/resolve order, including when
the receiver was unavailable. Accepted events are removed only after a durable
state write. A crash between receiver acceptance and that write can resend the
same delivery ID. Receivers must deduplicate it. A maximum backlog of 64 events
fails visibly and requires operator recovery rather than discarding history.

Exit code 0 means the observations passed and queued receiver requests were
accepted. Exit code 2 means an observed production failure with successful
receiver handling. Exit code 1 means configuration, state, execution or receiver
acceptance failed. A successful process is never evidence that an operator saw
the page.

## Independent receiver protocol

The receiver must accept `nabaperks.independent-monitor-alert.v1` JSON containing
only service, environment, action, incident ID, delivery ID, occurrence timestamp
and a fixed summary, plus the schema identifier. The first event is `trigger`;
`resolve` uses the same incident ID and a new delivery ID. Each request carries:

- `x-nabaperks-delivery`: stable delivery ID across retries;
- `x-nabaperks-timestamp`: current Unix seconds for this transport attempt;
- `x-nabaperks-signature`: `v1=` plus lowercase HMAC-SHA256 of
  `timestamp + "." + exact request body`, using the separate signing secret.

Verify signatures before parsing/acting, bound clock skew, persist delivery-ID
deduplication and preserve per-incident event order. Old queued events retain
their original occurrence time but receive a fresh transport signature. Do not
interpret a delayed resolve as current health without respecting subsequent
ordered events.

The runner retries network errors, HTTP 429 and server errors up to three times,
with one- then two-second backoff. Other non-success responses fail immediately.
Redirects are never followed. A 2xx response means **receiver acceptance only**;
provider delivery, receipt signatures and human acknowledgement require their
own external readbacks. The runner does not fabricate those stages or implement
the independent receiver's paging integration.

## Qualification still required

Run outage, delayed-receiver, restart/replay, scheduler-loss and recovery
rehearsals with the provisioned system. Record exact deployed source/config
digests, scheduler/runtime/state/provider dependency inventory, real timings,
signed receiver receipts, provider message IDs and delivered status, and named
operator acknowledgements for trigger and recovery. Validate the reviewed
evidence with `scripts/recovery/monitoring-evidence.mjs` against
`config/independent-monitoring-contract.json` using a protected evidence digest.

Local fixture-transport tests prove state transitions, rejection rules and
protocol construction. They do not establish external independence, scheduler
liveness, delivery or human acknowledgement. No live notification was sent while
implementing this runner.
