# Cloudflare tracing preview implementation plan

Prepared on 12 September 2026 against source revision
`f196da9c3afb8bbd3df1496f3959c00110a7defd`.
Status: planning and static inspection complete; application implementation,
Worker build, deployment and dashboard verification remain outstanding.

The first deliverable is an isolated Cloudflare Workers preview of Nabaperks,
with useful request traces and evidence of compatibility. The user selected
the existing-app preview, 100% request sampling, and recording of messages and
tool payloads, and asked to maximise the benefits of the work.

The user also confirmed an existing **Cloudflare startup grant**. Plan the
preview around the account's grant-funded capabilities, rather than assuming
Workers Free limits are the available budget. The grant's account, active
entitlements, remaining balance, expiry and product coverage have not yet been
read back from Cloudflare.

The production application continues to use its existing Vercel release path
during this milestone. Choosing this preview does not authorise a production
migration, uncovered cash spending, or deployment during planning. Prefer a
grant-covered Workers runtime suited to the application once coverage is
verified; a paid product label alone does not establish an out-of-pocket cost.

## Scope and evidence

Nabaperks uses Next.js 16.3.3, React 19.2.8 and pnpm 10.28.0. Inspection found
118 application pages, 36 route handlers, an existing `proxy.ts`, and startup
and request-error hooks in `instrumentation.ts`. There is no Wrangler target,
supported AI agent framework, or model-call entry point in the application.

Consequently, this milestone produces **Workers application request traces**.
The selected message/tool recording preference applies when an actual agent
entry point is implemented in a separately defined feature. It does not create
LLM messages where none exist, require a model subscription, or mean recording
all HTTP bodies, cookies and authentication headers. Do not emit `invoke_agent`
spans for ordinary application requests or report agent session replay as ready.

Cloudflare currently recommends vinext for existing Next.js applications on
Workers. It reimplements the Next.js API surface on Vite and remains in beta;
adoption therefore starts with a compatibility experiment.
[Cloudflare Next.js guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)

The pinned `vinext@1.0.0-beta.9 check` command completed successfully. A second
scan used a temporary copy of 982 tracked application and root configuration
files, excluding local output and environment files. It reported 25 supported
checks and no partial or unsupported checks. The broader checkout scan's Google
Fonts warning did not reproduce in the tracked application scope. These are
heuristic checks, not evidence that every dependency, configuration option or
journey runs correctly on Workers. The temporary snapshot was removed.

## 1. Establish the preview target and startup-grant budget

- Start implementation in an isolated `codex/cloudflare-tracing-preview`
  worktree from an agreed current base. Re-read the repository guidance and
  inspect existing work before making changes.
- Read the intended Cloudflare account, Workers plan, existing Workers, account
  allowances and available preview access controls. Locate the account holding
  the startup grant before selecting the preview target. Select an unused
  preview Worker name; do not overwrite an existing Worker.
- Verify the grant's active status, remaining balance, currency, expiry,
  applicable product caps and current entitlements using account billing and
  award information. Cloudflare's read-only account credits API can supply
  balance, validity dates and projected depletion where available; do not
  infer product coverage from a balance alone. Account access or missing
  fields are recorded as unresolved rather than guessed.
  [Account credits API](https://developers.cloudflare.com/api/resources/billing/)
- Reconcile eligible charges against the account's actual credit application
  or invoice evidence. Explicitly verify Workers requests/CPU, any base
  subscription, and Workers Observability after 1 October 2026. Check any
  required KV, R2 or preview access-control charges individually. Keep external
  providers such as Supabase, Stripe, Resend and Twilio in a separate budget.
- Use three columns in the cost estimate: standard-price usage, grant credits
  or included benefits applied, and expected cash charges. Allocate a bounded
  preview budget from the remaining grant while accounting for other projects
  sharing it. Existing credit does not imply unlimited project spending.
- Inventory an isolated Supabase test environment and provider test facilities.
  Do not copy production customer data or production credentials into the preview.
  If no suitable test service is available, qualify local fixtures first and
  record the hosted service tests that remain unavailable.
- Define the preview hostname, app origin, allowed auth callback URLs and
  secret names before a hosted build. Use separate signing/encryption secrets.
  An authenticated preview must also reject requests through alternate public
  Worker URLs that would bypass its access control.
- Measure compressed Worker size, CPU time, memory and supporting storage needs
  against the **grant account's actual runtime entitlements**. Prefer covered
  Workers Paid capabilities where they fit the application; avoid restricting
  the experiment to Free purely because it has no list-price subscription.
  Free's 100,000 dynamic requests/day and 10 ms CPU/invocation remain fallback
  reference limits. Workers Paid's standard $5 monthly base charge is a
  list-price input; verify whether the grant covers or waives it. Any uncovered
  charge requires a concrete cost decision before activation.
  [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
  [Runtime limits](https://developers.cloudflare.com/workers/platform/limits/)

Cloudflare says confirmed startup benefits offset eligible usage, with
product-specific caps and exclusions; AI Gateway is currently excluded.
Published credits last one year or until exhausted. The user's actual award
and account determine applicable coverage and dates.
[Cloudflare Startup Program](https://www.cloudflare.com/startups/)

Acceptance: a named preview target on the grant account, isolated service
inventory, verified grant evidence and an estimate separating credit use from
cash cost. Local compatibility work may continue while account verification is
outstanding; covered-hosting claims require that verification.

## 2. Add an independent Workers build path

- Pin a compatible vinext, Vite, Cloudflare adapter and Wrangler dependency set
  in the existing pnpm manifest and lockfile. The registry versions observed
  during planning were vinext `1.0.0-beta.9`, `@vinext/cloudflare`
  `1.0.0-beta.7`, and Wrangler `4.131.1`; verify their peer dependencies together
  before adopting them.
- Add a Vite configuration and preview Wrangler configuration, using the
  adapter's supported generated Worker entry point. Keep the established
  `dev`, `build`, `start` and Vercel release commands working.
- Add explicit scripts for Cloudflare development, build, local preview,
  generated types and a compatible dry run. Inspect any initializer changes;
  it must not deploy or silently replace the existing toolchain.
- Exclude generated Vite/Workers output and local Worker secrets from Git.
  Preserve the `.env.example` / `config/env-contract.json` parity whenever new
  application environment fields are introduced.
- Keep Cloudflare runtime imports behind its own server entry or adapter so
  they cannot break the existing Node build or enter a browser bundle.

Acceptance: both the original Next.js build and the Cloudflare build succeed,
with generated artifacts bound to the same source revision.

## 3. Qualify application behaviour on Workers

| Area                             | Repository evidence and implementation work                                                                                                                                                                                                             | Required proof                                                                                                                                                                 |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Hosted environment               | `scripts/check-env.mjs`, `lib/customer/verification.ts`, health/readiness routes and instrumentation use Vercel-specific environment fields. Introduce a tested deployment-profile mapping where necessary; do not impersonate Vercel to bypass checks. | Preview is identified as hosted; local OTP shortcuts and dev harnesses remain inaccessible; startup validates secrets; health reports the actual platform and source revision. |
| Authentication and request trust | `proxy.ts` refreshes Supabase sessions, forwards request metadata, issues cookies and applies CSP. Check Workers forwarding-header trust and secure-cookie behaviour.                                                                                   | Customer and merchant login, refresh, logout, Safari persistence, CSRF/origin checks, spoofed headers and rate limiting behave as intended.                                    |
| Loyalty and rewards              | Existing server-side actions and Supabase RPCs own stamps, rewards, identity and consent.                                                                                                                                                               | Test-fixture QR scan, stamp, unlock and redemption journeys preserve tenant isolation, audit records and duplicate-operation handling.                                         |
| PDFs and assets                  | `lib/notifications/poster-pdf-document.ts` reads TTF files with `node:fs`; other print helpers read files or write operator output. Classify deployed code separately from operator-only tooling.                                                       | Fonts and images load; poster PDFs and QR images render and decode; deployed paths use supported bundled assets; operator-only disk writes stay outside the Worker.            |
| Framework behaviour              | `next.config.ts` uses import optimisation, bundler options, headers and redirects; `lib/cache/tags.ts` uses tag invalidation.                                                                                                                           | Equivalent security headers, redirects, Server Actions, RSC navigation, local fonts, Open Graph images, cache isolation and post-mutation refreshes.                           |
| Provider integrations            | Supabase, Stripe, Resend, Twilio and Web Push have different runtime and test requirements.                                                                                                                                                             | Supported signing/crypto and test-mode request/response behaviour; webhook signature and duplicate-delivery checks; unavailable live provider proof remains labelled.          |
| Background work                  | Vercel currently owns the application's cron schedules.                                                                                                                                                                                                 | No preview cron schedules or duplicate production jobs; scheduled behaviour is exercised explicitly using test fixtures.                                                       |

Where shared code needs adaptation, retain server-authoritative enforcement and
backward compatibility with the existing Vercel application. Do not treat a
rendered page or HTTP 200 as proof of authentication, billing or loyalty safety.

## 4. Configure useful tracing at the selected settings

Enable tracing in the selected preview Wrangler target, preserving unrelated
observability and log-sampling settings:

```jsonc
{
  "observability": {
    "traces": {
      "enabled": true,
    },
  },
}
```

The omitted `head_sampling_rate` defaults to `1`, matching the user's **100%**
choice. Verify the effective generated/deployed configuration rather than only
the source file. All eligible Worker invocations are selected for tracing;
static assets served without a Worker invocation, retention, quotas and span
limits mean this is not a promise of a permanent, lossless record of every hit.
[Workers tracing](https://developers.cloudflare.com/workers/observability/traces/)

Start with automatic request and outbound-fetch spans. Add a small number of
custom spans around the most useful application boundaries: session validation,
QR verification, stamp processing, reward collection, and provider adapters.
Reuse automatic spans instead of wrapping every function or duplicating each
fetch. Use stable operation names and separate expected business refusals from
unexpected technical errors.
[Custom spans](https://developers.cloudflare.com/workers/observability/traces/custom-spans/)

Correlate operations with an opaque request ID, preview environment, source
revision, safe route template and outcome code. Do not use email addresses,
phone numbers, coordinates, user-supplied text or bearer tokens as identifiers.
Reuse `sanitizeTelemetryUrl` for application-owned URL attributes.

Inspect platform-generated attributes as well as custom attributes. Cloudflare
documents automatic `url.full`, `url.path` and outbound `url.query` capture;
sanitising a custom attribute does not prove those originals are removed.
Tokenised routes and Supabase query filters need an explicit recording-boundary
test. Keep the preview on synthetic data; isolate or resolve any credential or
bearer-token exposure before qualifying sensitive journeys.
[Automatic span attributes](https://developers.cloudflare.com/workers/observability/traces/spans-and-attributes/)

The user selected **record messages and tool payloads**. If a subsequent scoped
AI feature supplies an actual agent, detect the framework and turn owner at that
time, instrument it once, enable the framework's payload settings, and provide
the required shared agent name, stable instance ID and opaque conversation ID.
Do not install unused agent/model packages during this preview milestone.
Payload recording remains subject to Cloudflare's size and retention limits.
[Agent tracing setup](https://developers.cloudflare.com/agent-setup/tracing.md)

Acceptance: real preview requests produce useful non-duplicated spans, the
effective sampling is 100%, and sensitive recording boundaries are understood
and verified. Report agent-specific instrumentation as not applicable until
an agent actually exists.

## 5. Turn traces into practical diagnostic evidence

- Save useful queries or their reproducible definitions for failed requests,
  slow routes, authentication failures, QR/stamp refusals, reward failures and
  provider latency, where the available Cloudflare dashboard supports them.
- Associate every result with the Worker, preview environment and deployed
  revision. Keep expected guest-facing outcomes separate from infrastructure
  faults so ordinary refusals do not become noisy incident signals.
- Compare the same bounded fixture journeys between the original local
  Next.js build and the Workers preview. Record warm/cold latency, errors, CPU,
  bundle size and spans per invocation; report sample counts alongside any
  percentiles. Do not present local runtime comparisons as production geography
  or load-test evidence.
- Estimate daily events from measured invocations and average span count, plus
  logs. At 100% sampling, 1,000 invocations with eight spans each would produce
  about 8,000 trace events; eight is an illustration, not a measured result.
- Use the grant to qualify useful capabilities: realistic CPU headroom,
  complete selected-journey traces, an appropriate persistent cache if needed,
  and preview access controls where covered. Add services only when they solve
  a measured need. Preserve the requested 100% tracing and agent payload policy.
- Forecast grant consumption using measured preview usage and the account's
  other workloads. Show expected cash cost after expiry or exhaustion as well
  as the current credited cost. Verify any applicable taxes separately before
  promising zero out-of-pocket cost.
- Include credit-balance, product-cap and expiry checks in the future runbook.
  Propose actionable budget thresholds and an expiry/depletion checkpoint;
  alerts are notifications, not spending caps. Prepare an explicit preview
  shutdown or owner-approved continuation before benefits end. Do not create
  reminders, contact Cloudflare or change billing settings during planning.
- Prepare a runbook for finding a trace, identifying a slow provider operation,
  inspecting a failed loyalty journey, disabling preview tracing and removing
  the preview without affecting production. Alerts should be proposed only
  after meaningful thresholds and any additional costs are known.

Workers tracing is free in its current beta. From **1 October 2026**, trace
spans share the Workers Observability allowance with logs: Free has 200,000
events/day with three-day retention; Paid includes 20 million/month with
seven-day retention and charges $0.60 per additional million events. These
are standard prices before startup benefits. Determine whether the user's
award covers these specific observability charges when billing starts;
Workers eligibility alone does not verify every billing item. Compute,
storage and any provider model calls are accounted for separately. Report
credit consumption and cash charges separately, including the post-grant
estimate. Preserve the chosen 100% sampling; bound pilot traffic and duration
to its allocated grant budget rather than silently reducing the user's rate.
[Tracing pricing](https://developers.cloudflare.com/workers/observability/traces/#limits--pricing)

Cloudflare currently documents limits on automatic propagation to services
outside Cloudflare. A timed Supabase/Stripe HTTP call is not a full database or
provider-internal trace. Some CPU-only spans can also report zero milliseconds.
[Known limitations](https://developers.cloudflare.com/workers/observability/traces/known-limitations/)

## 6. Validation and delivery sequence

1. Run targeted formatter, type, contract and unit checks while implementing.
   Add meaningful tests for runtime-profile enforcement, tracing sanitisation
   and changed platform boundaries.
2. Run `pnpm quality:fast`, `pnpm quality:check` and the original `pnpm build`.
   Build through the new Cloudflare/Vite script and test its actual Worker
   output locally; a passing `next dev` session is insufficient.
3. Run Wrangler's dry run against the generated Worker configuration when
   supported by the selected adapter. Record size and compatibility findings.
   A dry run does not replace the Vite build or application tests.
4. Exercise the service-backed DB, browser, accessibility and visual checks
   against isolated fixtures and the affected Workers paths. Record each
   unavailable check and the missing service or runtime requirement.
5. Use the normal review and hosted CI process. Run `pnpm ops:factory:status`
   before claiming delivery readiness. Keep the existing release gates and
   production migration chain authoritative.
6. Present the built preview, configuration diff, exact source revision,
   measured resource needs, grant eligibility evidence, forecast credit use,
   uncovered cash costs and unresolved service requirements. Deploy only
   after the preview deployment is authorised; the original Cloudflare setup
   instructions explicitly exclude deployment from configuration work.
7. After that deployment, record the actual Worker version, access policy,
   effective tracing configuration, test journeys and real dashboard trace
   evidence. Classify source, local tests, hosted preview, provider proof and
   production status separately. Production migration requires its own plan.

## Proposed change groups

| Group                 | Expected files or responsibility                                                                                      | Completion criterion                                                   |
| --------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Preview foundation    | `package.json`, `pnpm-lock.yaml`, `vite.config.ts`, preview Wrangler config, `.gitignore`, generated type integration | Reproducible Workers build; existing Next.js build still passes.       |
| Runtime compatibility | Environment helpers/contracts, `instrumentation.ts`, health/readiness, affected auth/proxy, asset and cache adapters  | Hosted enforcement and fixture journeys work on both runtimes.         |
| Diagnostic value      | Cloudflare entry/adapter, selected `lib/observability/` helpers and domain boundaries, focused tests, runbook         | Useful request traces with measured volume and verified data handling. |
| Hosted qualification  | Isolated preview configuration and deployment evidence after authorisation                                            | Real Worker/version and dashboard proof; no production cutover.        |

These are bounded delivery groups; combine closely related edits before
triggering hosted CI, and do not create a parallel release authority.

The next implementation action is to create the isolated preview worktree and
build the vinext/Workers target using test configuration. The deployment
preflight must identify the grant account and verify its balance, coverage and
expiry alongside test-service availability and actual resource costs. The
grant is user-confirmed; account-specific credit application remains unverified.
