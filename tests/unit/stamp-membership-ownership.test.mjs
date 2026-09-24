import assert from "node:assert/strict"
import { test } from "node:test"
import { build } from "esbuild"

/**
 * The stamp paths refuse a URL membership the signed-in customer does not own
 * before any service-role RPC runs — no attempt is charged and no stamp issued.
 *
 * Runs the real module; only identity, persistence, analytics and the logger
 * are substituted. The fixture records every Supabase call.
 */
async function loadStamp() {
  const result = await build({
    stdin: {
      contents: `export { issueSelfServiceStamp, issueVenueCodeStamp } from "./lib/customer/stamp.ts"; export { state } from "fixture-state";`,
      resolveDir: process.cwd(),
    },
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    plugins: [
      {
        name: "stamp-boundaries",
        setup(build) {
          build.onResolve(
            {
              filter:
                /^(fixture-state|server-only|@\/lib\/supabase\/server|@\/lib\/customer\/identity|@\/lib\/analytics\/events|@\/lib\/observability\/logger)$/,
            },
            ({ path }) => ({ path, namespace: "fixture" })
          )
          build.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => ({
            contents:
              path === "server-only"
                ? ""
                : path === "fixture-state"
                  ? `export const state = { customer: null, membership: null, membershipError: null, rpcs: [], membershipLookups: [] };`
                  : path.endsWith("identity")
                    ? `import {state} from "fixture-state"; export async function getCurrentCustomer() { return state.customer; }`
                    : path.endsWith("events")
                      ? `export async function recordProductEvent() {}`
                      : path.endsWith("logger")
                        ? `export const logger = { info() {}, warn() {}, error() {} };`
                        : `import {state} from "fixture-state";
function query(table) {
  const filters = {};
  const chain = {
    select() { return chain; },
    eq(column, value) { filters[column] = value; return chain; },
    async maybeSingle() {
      if (table !== "customer_memberships") throw new Error("unexpected table " + table);
      state.membershipLookups.push(filters);
      if (state.membershipError) return { data: null, error: { message: state.membershipError } };
      return { data: state.membership, error: null };
    },
  };
  return chain;
}
const ISSUED = [{ stamp_event_id: "event-1", new_stamp_count: 3, reward_unlocked: false, geo_flagged: false }];
export function createSupabaseServiceRoleClient() {
  return {
    from: query,
    async rpc(name, args) {
      state.rpcs.push({ name, args });
      if (name === "drain_due_referrer_bonuses_for_membership") return { data: 0, error: null };
      if (name === "issue_self_service_stamp") return { data: ISSUED, error: null };
      if (name === "issue_venue_code_stamp") return { data: ISSUED, error: null };
      return { data: null, error: null };
    },
  };
}`,
          }))
        },
      },
    ],
  })
  return import(
    `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}#${crypto.randomUUID()}`
  )
}

function seed(mod, overrides = {}) {
  Object.assign(mod.state, {
    customer: { id: "customer-1" },
    membership: { merchant_id: "merchant-1", customer_id: "customer-1" },
    membershipError: null,
    rpcs: [],
    membershipLookups: [],
    ...overrides,
  })
}

const VENUE_CODE_INPUT = {
  membershipId: "membership-1",
  qrId: "qr-1",
  code: "123456",
  deviceHash: null,
  networkHash: null,
}

const STAMP_PATHS = [
  ["self-service", (mod) => mod.issueSelfServiceStamp("membership-1")],
  ["venue-code", (mod) => mod.issueVenueCodeStamp(VENUE_CODE_INPUT)],
]

for (const [label, issue] of STAMP_PATHS) {
  test(`${label}: a membership owned by someone else is refused before any RPC`, async () => {
    const mod = await loadStamp()
    seed(mod, {
      membership: { merchant_id: "merchant-1", customer_id: "someone-else" },
    })

    const result = await issue(mod)

    assert.equal(result.status, "blocked")
    assert.equal(result.blockReason, "unavailable")
    assert.deepEqual(mod.state.rpcs, [], "no attempt charged, no stamp issued")
    assert.equal(mod.state.membershipLookups[0].id, "membership-1")
  })

  test(`${label}: a membership that does not exist is refused before any RPC`, async () => {
    const mod = await loadStamp()
    seed(mod, { membership: null })

    const result = await issue(mod)

    assert.equal(result.status, "blocked")
    assert.equal(result.blockReason, "unavailable")
    assert.deepEqual(mod.state.rpcs, [])
  })

  test(`${label}: a failed ownership read is an error, not a stamp`, async () => {
    const mod = await loadStamp()
    seed(mod, { membershipError: "offline" })

    await assert.rejects(issue(mod), /Unable to load stamp membership: offline/)
    assert.deepEqual(mod.state.rpcs, [])
  })

  test(`${label}: the owner's stamp proceeds as before`, async () => {
    const mod = await loadStamp()
    seed(mod)

    const result = await issue(mod)

    assert.equal(result.status, "issued")
    assert.equal(result.newStampCount, 3)
    assert.ok(mod.state.rpcs.length >= 2)
    for (const call of mod.state.rpcs) {
      const membershipArg =
        call.args?.p_membership_id ?? call.args?.p_referrer_membership_id
      assert.equal(membershipArg, "membership-1")
    }
  })
}

test("signed-out callers are refused before the ownership read", async () => {
  const mod = await loadStamp()
  seed(mod, { customer: null })

  const result = await mod.issueSelfServiceStamp("membership-1")

  assert.equal(result.blockReason, "unauthenticated")
  assert.equal(mod.state.membershipLookups.length, 0)
  assert.deepEqual(mod.state.rpcs, [])
})
