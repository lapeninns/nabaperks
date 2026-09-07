import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

// contract-db-venue-code-stamp — pins the venue-code fallback's shape:
//   1. every CHECK is added NOT VALID and validated in the same migration,
//   2. the private stamp primitive has no location-bypass argument and only
//      honours a receipt written in the SAME transaction (pg_current_xact_id),
//   3. nothing in `private` is executable by any API role, and the public
//      overloads stay service-role only,
//   4. the excised staff subsystem does not creep back in under a new name,
//   5. the code itself and raw coordinates never reach a raise, an event
//      payload or a log line, and
//   6. the privacy-retention cron sweeps stale lockouts non-fatally.
// Behavioural proof: tests/db/venue-code-derivation.test.mjs and
// tests/db/visit-stamp-private-primitives.test.mjs.

const schema = readFileSync(
  "supabase/migrations/20260907100000_venue_code_stamp_schema.sql",
  "utf8"
)
const primitives = readFileSync(
  "supabase/migrations/20260907100100_visit_stamp_private_primitives.sql",
  "utf8"
)
const route = readFileSync("app/api/cron/privacy-retention/route.ts", "utf8")

const stripComments = (sql) => sql.replace(/^\s*--.*$/gm, "")

test("every CHECK is added NOT VALID and validated in the same migration", () => {
  for (const name of [
    "venue_code_stamp_receipts_failure_reason_check",
    "venue_code_stamp_receipts_device_hash_check",
    "venue_code_attempt_lockouts_failed_count_check",
  ]) {
    assert.match(
      schema,
      new RegExp(`add constraint ${name}[\\s\\S]{0,200}?not valid`),
      `${name} is added NOT VALID`
    )
    assert.match(
      schema,
      new RegExp(`validate constraint ${name}`),
      `${name} is validated in the same migration`
    )
  }
})

test("the private primitive has no bypass flag and only honours in-transaction evidence", () => {
  const body = stripComments(primitives)
  assert.doesNotMatch(
    body,
    /skip_location|p_skip|bypass_location/i,
    "no boolean bypass exists"
  )
  assert.match(
    body,
    /receipts\.transaction_id = pg_current_xact_id\(\)/,
    "presence evidence is tied to the current transaction"
  )
  assert.match(
    body,
    /Presence evidence must be recorded in this transaction/,
    "a fabricated p_presence is a privilege failure"
  )
  assert.match(
    body,
    /v_geo_verification := 'venue_code'/,
    "a code-confirmed stamp is labelled venue_code"
  )
  assert.doesNotMatch(
    body,
    /p_presence is not null[\s\S]{0,400}v_geo_verification := 'verified'/,
    "a code-confirmed stamp is never labelled GPS-verified"
  )
})

test("private functions are revoked from every role; public overloads stay service-role only", () => {
  for (const fn of [
    "private.venue_code_day",
    "private.venue_code_for",
    "private.visit_stamp_refusal_code",
    "private.issue_visit_stamp",
    "private.issue_qr_visit_stamp",
  ]) {
    const source = fn.includes("venue_code") ? schema : primitives
    assert.match(
      source,
      new RegExp(
        `revoke all on function ${fn.replace(".", "\\.")}\\([^)]*\\)\\s+from public, anon, authenticated, service_role`
      ),
      `${fn} is executable by no API role`
    )
  }
  assert.match(
    schema,
    /revoke all on schema private from public, anon, authenticated, service_role/
  )
  assert.match(
    schema,
    /revoke all on table private\.venue_code_seeds\s+from public, anon, authenticated, service_role/
  )

  const publicGrants = primitives.match(
    /grant execute on function public\.issue_self_service_stamp\([^)]*\)\s+to service_role/g
  )
  assert.equal(
    publicGrants?.length,
    2,
    "both public overloads are re-granted to service_role only"
  )
  assert.doesNotMatch(
    primitives,
    /grant execute on function public\.issue_self_service_stamp\([^)]*\)\s+to (authenticated|anon)/,
    "no public overload is widened"
  )
})

test("the excised staff subsystem does not return under the venue-code name", () => {
  for (const source of [schema, primitives]) {
    assert.doesNotMatch(
      source,
      /staff_users|add_staff_member|set_staff_member_active|is_staff_for_merchant/,
      "no legacy staff identifier reappears"
    )
  }
})

test("the code and raw coordinates never reach a raise, an event payload or a log", () => {
  for (const source of [schema, primitives]) {
    const body = stripComments(source)
    for (const line of body.split("\n")) {
      if (/raise (exception|warning|notice|log)/i.test(line)) {
        assert.doesNotMatch(
          line,
          /p_code|v_code|venue_code_for/,
          `a raise must not carry the code: ${line.trim()}`
        )
      }
    }
    assert.doesNotMatch(
      body,
      /jsonb_build_object\([^;]*\bp_(latitude|longitude)\b/,
      "raw coordinates are never written into an event payload"
    )
    assert.doesNotMatch(
      body,
      /jsonb_build_object\([^;]*\b(p_code|v_code)\b/,
      "the code is never written into an event payload"
    )
  }
})

test("the schema migration stores no per-day code and creates the seed lazily", () => {
  assert.match(schema, /create table if not exists private\.venue_code_seeds/)
  assert.doesNotMatch(
    stripComments(schema),
    /create table[^;]*venue_code(s|_values|_history)\b/,
    "no table of codes"
  )
  assert.match(
    schema,
    /extensions\.gen_random_bytes\(32\)/,
    "a 256-bit random seed"
  )
  assert.match(schema, /extensions\.hmac\(/, "the code is an HMAC of the seed")
  assert.match(
    schema,
    /interval '5 hours'/,
    "the venue-code day rolls at 05:00, not midnight"
  )
})

test("the privacy-retention cron sweeps stale lockouts non-fatally", () => {
  assert.match(
    schema,
    /create or replace function public\.purge_stale_venue_code_lockouts/
  )
  assert.match(
    schema,
    /grant execute on function public\.purge_stale_venue_code_lockouts[\s\S]{0,90}to service_role/,
    "service_role keeps execute"
  )
  assert.match(
    route,
    /purge_stale_venue_code_lockouts/,
    "the cron invokes the purge"
  )
  assert.match(
    route,
    /privacy_retention_venue_code_lockout_purge_failed/,
    "purge failures are logged without failing the other retention steps"
  )
  assert.match(route, /purgedVenueCodeLockouts/, "the purge count is reported")
  assert.match(
    route,
    /venueCodeLockoutError \|\|/,
    "the failure folds into partial_failure"
  )
})

test("both migrations end by reloading the PostgREST schema cache", () => {
  for (const source of [schema, primitives]) {
    const lastLine = source.trim().split("\n").at(-1)
    assert.equal(lastLine, "notify pgrst, 'reload schema';")
  }
})
