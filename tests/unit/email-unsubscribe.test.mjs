import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { test } from "node:test"
import { build } from "esbuild"

// Run the real route handlers, substituting only persistence and rate limits.
async function loadRoute(kind) {
  const result = await build({
    stdin: {
      contents: `export * from "./app/api/email/unsubscribe/${kind}/[token]/route.ts"; export * as invite from "./app/api/email/unsubscribe/invite/[token]/route.ts"; export * as claim from "./app/api/email/unsubscribe/claim/[token]/route.ts"; export { state } from "fixture-state";`,
      resolveDir: process.cwd(),
    },
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    plugins: [
      {
        name: "unsubscribe-boundaries",
        setup(build) {
          build.onResolve(
            {
              filter:
                /^(fixture-state|server-only|@\/lib\/supabase\/server|@\/lib\/security\/rate-limit)$/,
            },
            ({ path }) => ({ path, namespace: "fixture" })
          )
          build.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => ({
            contents:
              path === "server-only"
                ? ""
                : path === "fixture-state"
                  ? `export const state = { calls: [], limits: [], suppressed: new Set(), buckets: new Map(), failure: null };`
                  : path.endsWith("rate-limit")
                    ? `import {state} from "fixture-state"; export class RateLimitError extends Error {}; export async function enforceRateLimit(config) {state.limits.push(config); if(state.failure === "rate") throw new RateLimitError(); if(state.failure === "storage") throw new Error("offline"); const used = state.buckets.get(config.key) || 0; if(used >= config.limit) throw new RateLimitError(); state.buckets.set(config.key, used + 1);}`
                    : `import {state} from "fixture-state"; export function createSupabaseServiceRoleClient() {return {rpc: async (rpc,args) => {state.calls.push({rpc,args}); if(state.failure === "database") return {error:{message:"offline"}}; const key = args.p_unsubscribe_token_hash; const repeated = state.suppressed.has(key); state.suppressed.add(key); return {data: !repeated, error: null};}};}`,
          }))
        },
      },
    ],
  })
  return import(
    `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}#${crypto.randomUUID()}`
  )
}

for (const kind of ["invite", "claim"]) {
  test(`${kind}: anonymous mailbox POST suppresses, repeats acknowledge, GET never mutates`, async () => {
    const route = await loadRoute(kind)
    const token = "A".repeat(43)
    const url = `https://nabaperks.com/api/email/unsubscribe/${kind}/${token}`
    const context = { params: Promise.resolve({ token }) }
    const get = await route.GET(new Request(url), context)
    assert.equal(get.status, 307)
    assert.equal(
      get.headers.get("location"),
      `https://nabaperks.com/${kind}/unsubscribe/${token}`
    )
    assert.equal(route.state.calls.length, 0)
    for (let repeat = 0; repeat < 2; repeat++) {
      const res = await route.POST(
        new Request(url, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: "List-Unsubscribe=One-Click",
        }),
        context
      )
      assert.equal(res.status, 200)
      assert.equal(await res.text(), "")
      assert.equal(res.headers.get("location"), null)
      assert.equal(res.headers.get("set-cookie"), null)
      assert.match(res.headers.get("cache-control"), /no-store/)
    }
    assert.equal(route.state.suppressed.size, 1)
    assert.equal(
      route.state.calls[0].rpc,
      kind === "invite"
        ? "suppress_loyalty_invite_email"
        : "suppress_reward_invite_email_by_token"
    )
    assert.deepEqual(route.state.calls[0].args, {
      p_unsubscribe_token_hash: createHash("sha256")
        .update(token)
        .digest("hex"),
    })
    assert.equal(route.state.limits.length, 4)
    assert.ok(route.state.limits.every((c) => !c.key.includes(token)))
  })
  test(`${kind}: malformed tokens and failed storage never acknowledge suppression`, async () => {
    const route = await loadRoute(kind)
    const request = new Request("https://nabaperks.com", { method: "POST" })
    assert.equal(
      (await route.POST(request, { params: Promise.resolve({ token: "bad" }) }))
        .status,
      400
    )
    assert.equal(route.state.calls.length, 0)
    for (const [failure, status] of [
      ["rate", 429],
      ["storage", 503],
      ["database", 503],
    ]) {
      route.state.failure = failure
      const res = await route.POST(request, {
        params: Promise.resolve({ token: "B".repeat(43) }),
      })
      assert.equal(res.status, status)
      assert.equal(res.headers.get("retry-after"), "60")
      assert.equal(res.headers.get("location"), null)
    }
    assert.equal(route.state.suppressed.size, 0)
  })
}

test("rotating tokens and endpoint kinds share trusted caller admission before token persistence", async () => {
  const route = await loadRoute("invite")
  for (let index = 0; index < 305; index++) {
    const kind = index % 2 ? "invite" : "claim"
    const token = index.toString(16).padStart(43, "A")
    const response = await route[kind].POST(
      new Request(`https://nabaperks.com/?rotation=${index}`, {
        method: "POST",
        headers: {
          "x-vercel-forwarded-for": "192.0.2.10",
          "x-forwarded-for": `192.0.2.${index}`,
          "x-real-ip": `192.0.2.${index}`,
          "x-nabaperks-device-id": `device-${index}`,
          "user-agent": `agent-${index}`,
        },
        body: `rotation=${index}`,
      }),
      { params: Promise.resolve({ token }) }
    )
    assert.equal(response.status, index < 300 ? 200 : 429)
  }
  assert.equal(route.state.calls.length, 300)
  assert.equal(route.state.buckets.size, 301)
  assert.equal(
    route.state.limits.filter(({ key }) => !key.includes(":caller:")).length,
    300
  )
  const response = await route.invite.POST(
    new Request("https://nabaperks.com", {
      method: "POST",
      headers: { "x-vercel-forwarded-for": "192.0.2.11" },
    }),
    { params: Promise.resolve({ token: "B".repeat(43) }) }
  )
  assert.equal(
    response.status,
    200,
    "another provider caller retains an independent budget"
  )
})

test("missing trusted identity shares a bounded fallback despite spoofed forwarding headers", async () => {
  const route = await loadRoute("invite")
  const post = (index) =>
    route.POST(
      new Request("https://nabaperks.com", {
        method: "POST",
        headers: { "x-forwarded-for": `192.0.2.${index}` },
      }),
      {
        params: Promise.resolve({
          token: index.toString(16).padStart(43, "C"),
        }),
      }
    )
  assert.equal((await post(0)).status, 200)
  const caller = route.state.limits[0]
  route.state.buckets.set(caller.key, caller.limit)
  assert.equal((await post(1)).status, 429)
  assert.equal(route.state.calls.length, 1)
  assert.equal(route.state.buckets.size, 2)
})
