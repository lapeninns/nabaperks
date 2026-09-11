import assert from "node:assert/strict"
import { test } from "node:test"
import { build } from "esbuild"

/**
 * getMembershipLocationRequirement — the page-load payload the stamp screen
 * reads to decide whether a capture without a fix is worth submitting.
 *
 * Runs the real module; only identity, persistence, analytics and the logger
 * are substituted. The fixture records every Supabase call so the tests can
 * prove which reads happen and which are skipped.
 */
async function loadStamp() {
  const result = await build({
    stdin: {
      contents: `export { getMembershipLocationRequirement } from "./lib/customer/stamp.ts"; export { state } from "fixture-state";`,
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
                  ? `export const state = { customer: null, membership: null, location: null, card: null, counts: {}, graceLimit: 2, rpcs: [], countQueries: [] };`
                  : path.endsWith("identity")
                    ? `import {state} from "fixture-state"; export async function getCurrentCustomer() { return state.customer; }`
                    : path.endsWith("events")
                      ? `export async function recordProductEvent() {}`
                      : path.endsWith("logger")
                        ? `export const logger = { info() {}, warn() {}, error() {} };`
                        : `import {state} from "fixture-state";
function query(table) {
  const filters = {};
  let head = false;
  const chain = {
    select(_cols, opts) { head = Boolean(opts && opts.head); return chain; },
    eq(column, value) { filters[column] = value; return chain; },
    order() { return chain; },
    limit() { return chain; },
    async maybeSingle() {
      if (table === "customer_memberships") return { data: state.membership, error: null };
      if (table === "loyalty_cards") return { data: state.card, error: null };
      if (table === "merchant_locations") return { data: state.location, error: null };
      return { data: null, error: null };
    },
    then(resolve, reject) {
      if (!head) return Promise.reject(new Error("unexpected non-head query on " + table)).then(resolve, reject);
      state.countQueries.push({ table, filters });
      const key = filters["metadata->>geo_verification"] ? "unverified" : filters["metadata->>source"] ? "visits" : "other";
      const count = state.counts[key];
      if (count instanceof Error) return Promise.resolve({ count: null, error: { message: count.message } }).then(resolve, reject);
      return Promise.resolve({ count: count ?? 0, error: null }).then(resolve, reject);
    },
  };
  return chain;
}
export function createSupabaseServiceRoleClient() {
  return {
    from: query,
    async rpc(name, args) {
      state.rpcs.push({ name, args });
      if (name === "geofence_unverified_grace_limit") {
        if (state.graceLimit instanceof Error) return { data: null, error: { message: state.graceLimit.message } };
        return { data: state.graceLimit, error: null };
      }
      return { data: null, error: { message: "unexpected rpc " + name } };
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
    card: { location_id: "location-1" },
    location: {
      require_geofence: true,
      geofence_radius_meters: 150,
      soft_geofence_trigger_stamp_number: 3,
    },
    counts: { visits: 2, unverified: 0 },
    graceLimit: 2,
    rpcs: [],
    countQueries: [],
    ...overrides,
  })
}

test("a verification-required visit reports the unverified grace still available", async () => {
  const mod = await loadStamp()
  seed(mod, { counts: { visits: 2, unverified: 1 } })

  const requirement = await mod.getMembershipLocationRequirement("membership-1")

  assert.equal(requirement.requireGeofence, true)
  assert.equal(requirement.nextVisitNumber, 3)
  assert.equal(requirement.unverifiedGraceRemaining, 1)
  assert.deepEqual(
    mod.state.rpcs.map((call) => call.name),
    ["geofence_unverified_grace_limit"],
    "the limit comes from the database function, never a TypeScript constant"
  )
  const unverified = mod.state.countQueries.find(
    (q) => q.filters["metadata->>geo_verification"] === "unverified"
  )
  assert.ok(unverified, "committed unverified stamps are counted")
  assert.equal(unverified.filters.membership_id, "membership-1")
  assert.equal(unverified.filters.event_type, "earned")
})

test("spent grace reports zero, never a negative number", async () => {
  const mod = await loadStamp()
  seed(mod, { counts: { visits: 5, unverified: 3 }, graceLimit: 2 })

  const requirement = await mod.getMembershipLocationRequirement("membership-1")

  assert.equal(requirement.unverifiedGraceRemaining, 0)
})

test("before the verified-visit threshold the grace read is skipped and left undefined", async () => {
  const mod = await loadStamp()
  seed(mod, { counts: { visits: 1, unverified: 0 } })

  const requirement = await mod.getMembershipLocationRequirement("membership-1")

  assert.equal(requirement.nextVisitNumber, 2)
  assert.equal(requirement.unverifiedGraceRemaining, undefined)
  assert.equal(mod.state.rpcs.length, 0, "no limit read before it matters")
  assert.equal(
    mod.state.countQueries.some(
      (q) => q.filters["metadata->>geo_verification"] === "unverified"
    ),
    false
  )
})

test("a venue with the geofence off never reads grace", async () => {
  const mod = await loadStamp()
  seed(mod, {
    counts: { visits: 9, unverified: 0 },
    location: {
      require_geofence: false,
      geofence_radius_meters: 150,
      soft_geofence_trigger_stamp_number: 3,
    },
  })

  const requirement = await mod.getMembershipLocationRequirement("membership-1")

  assert.equal(requirement.requireGeofence, false)
  assert.equal(requirement.unverifiedGraceRemaining, undefined)
  assert.equal(mod.state.rpcs.length, 0)
})

test("a membership the signed-in customer does not own gets the default requirement", async () => {
  const mod = await loadStamp()
  seed(mod, {
    membership: { merchant_id: "merchant-1", customer_id: "someone-else" },
  })

  const requirement = await mod.getMembershipLocationRequirement("membership-1")

  assert.equal(requirement.requireGeofence, false)
  assert.equal(requirement.nextVisitNumber, 1)
  assert.equal(requirement.unverifiedGraceRemaining, undefined)
  assert.equal(mod.state.countQueries.length, 0, "no stamp rows are read")
})

test("a failing grace read is an error, not a silent zero that hides the courtesy path", async () => {
  const mod = await loadStamp()
  seed(mod, { graceLimit: new Error("offline") })

  await assert.rejects(
    mod.getMembershipLocationRequirement("membership-1"),
    /Unable to load unverified grace limit: offline/
  )
})
