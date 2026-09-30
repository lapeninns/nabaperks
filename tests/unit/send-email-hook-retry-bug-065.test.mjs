import assert from "node:assert/strict"
import { createHmac, randomUUID } from "node:crypto"
import path from "node:path"
import { test } from "node:test"
import { build } from "esbuild"

/**
 * QA BUG-065: Supabase Auth mints a fresh `webhook-id` (and signs a fresh
 * timestamp) for every retry of one send-email hook call, while the payload
 * bytes stay the same. The real route, envelope verification, delivery
 * orchestration and action classification run here; only the claim storage,
 * alias storage, analytics and Resend are in-memory stand-ins. The claim
 * stand-in follows `claim_auth_hook_delivery_v2`: a new key is claimed, a
 * completed or provider-attempted key replays, a live lease is busy and a
 * failed key may be claimed again.
 */

const SECRET = `v1,whsec_${Buffer.from("bug-065-hook-secret-for-tests").toString("base64")}`
const USER_ID = "0b9c7f55-5a4a-4c1e-9a53-4d3d1d0b6f21"

const REAL = new Set([
  "@/app/api/auth/hooks/signed-hook-envelope",
  "@/lib/auth/auth-hook-delivery-core",
  "@/lib/auth/merchant-email-otp-provider",
  "@/lib/auth/send-email-action-core",
  "@/lib/http/signed-webhook-body",
  "@/lib/notifications/provider-delivery-error",
  "@/lib/notifications/standard-webhook",
])

const STUBS = {
  "fixture-state": `export const state = {
    claims: new Map(),
    hold: null,
    aliases: [],
    sends: [],
    sendPlan: [],
    events: [],
  };`,
  "server-only": "",
  "next/server": `export class NextResponse extends Response {
    static json(body, init) { return Response.json(body, init) }
  }`,
  "@/lib/analytics/funnel-events": `import { state } from "fixture-state";
    export function recordMerchantFunnelEventSafely(input) { state.events.push(input) }`,
  "@/lib/auth/auth-hook-delivery": `import { state } from "fixture-state";
    const key = (channel, id) => channel + ":" + id;
    export async function claimAuthHookDelivery(channel, id) {
      const row = state.claims.get(key(channel, id));
      if (!row || row.status === "failed") {
        const leaseId = crypto.randomUUID();
        state.claims.set(key(channel, id), { status: "processing", leaseId, attempted: false });
        return { status: "claimed", leaseId };
      }
      if (row.status === "completed") return { status: "replay" };
      return { status: "busy" };
    }
    function settle(channel, id, leaseId, status) {
      const row = state.claims.get(key(channel, id));
      if (!row || row.leaseId !== leaseId || row.status !== "processing") throw new Error("lease lost");
      row.status = status;
    }
    export async function markAuthHookDeliveryAttempted(channel, id, leaseId) {
      const row = state.claims.get(key(channel, id));
      if (!row || row.leaseId !== leaseId) throw new Error("lease lost");
      row.attempted = true;
    }
    export async function completeAuthHookDelivery(channel, id, leaseId) { settle(channel, id, leaseId, "completed") }
    export async function failAuthHookDelivery(channel, id, leaseId) { settle(channel, id, leaseId, "failed") }`,
  "@/lib/auth/merchant-email-otp-alias": `import { state } from "fixture-state";
    export async function createMerchantEmailOtpAlias(input) {
      for (const alias of state.aliases) if (alias.live && alias.email === input.email) { alias.live = false; alias.resolution = "superseded" }
      const alias = { ...input, aliasId: crypto.randomUUID(), aliasCode: String(100000 + state.aliases.length), live: true };
      state.aliases.push(alias);
      return { aliasId: alias.aliasId, aliasCode: alias.aliasCode };
    }
    export async function revokeMerchantEmailOtpAlias({ aliasId }) {
      const alias = state.aliases.find((row) => row.aliasId === aliasId);
      if (!alias || !alias.live) return false;
      alias.live = false; alias.resolution = "delivery_failed";
      return true;
    }`,
  "@/lib/notifications/resend": `import { state } from "fixture-state";
    import { DefinitiveProviderRejectionError } from "@/lib/notifications/provider-delivery-error";
    export function readEmailOtpConfig() { return { apiKey: "re_test", from: "test@example.test" } }
    export async function sendEmailOtp(input) {
      if (state.hold) await state.hold;
      await input.beforeProviderAttempt?.();
      const outcome = state.sendPlan.shift() ?? "accepted";
      state.sends.push({ to: input.to, code: input.code, idempotencyKey: input.idempotencyKey, outcome });
      if (outcome === "ambiguous") throw new Error("Resend request timed out after the request left");
      if (outcome === "rejected") throw new DefinitiveProviderRejectionError("Resend send failed (422)");
    }`,
}

async function loadRoute() {
  const root = process.cwd()
  const result = await build({
    stdin: {
      contents:
        'export { POST } from "./app/api/auth/hooks/send-email/route.ts"; export { state } from "fixture-state";',
      resolveDir: root,
      loader: "ts",
    },
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    logLevel: "silent",
    plugins: [
      {
        name: "send-email-hook-boundaries",
        setup(build) {
          build.onResolve({ filter: /^@\// }, ({ path: specifier }) =>
            REAL.has(specifier)
              ? { path: path.join(root, `${specifier.slice(2)}.ts`) }
              : undefined
          )
          build.onResolve(
            { filter: /^(fixture-state|server-only|next\/|@\/)/ },
            ({ path: specifier }) => ({ path: specifier, namespace: "fixture" })
          )
          build.onLoad(
            { filter: /.*/, namespace: "fixture" },
            ({ path: id }) => {
              assert.ok(id in STUBS, `Unrecognised boundary: ${id}`)
              return { contents: STUBS[id], resolveDir: root }
            }
          )
        },
      },
    ],
  })
  return import(
    `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}#${randomUUID()}`
  )
}

/** One GoTrue invocation attempt: same body, its own webhook-id and timestamp. */
function signedAttempt(body, { webhookId, timestamp }) {
  const key = Buffer.from(
    SECRET.replace(/^v1,/, "").replace(/^whsec_/, ""),
    "base64"
  )
  const signature = createHmac("sha256", key)
    .update(`${webhookId}.${timestamp}.${body}`)
    .digest("base64")
  return new Request("http://127.0.0.1/api/auth/hooks/send-email", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "webhook-id": webhookId,
      "webhook-timestamp": String(timestamp),
      "webhook-signature": `v1,${signature}`,
    },
    body,
  })
}

function otpPayload({ token = "314159", action = "magiclink" } = {}) {
  return JSON.stringify({
    user: { id: USER_ID, email: "venue@example.test" },
    email_data: {
      token,
      token_hash: `hash-${token}`,
      email_action_type: action,
      redirect_to: "http://127.0.0.1:3000",
      site_url: "http://127.0.0.1:3000",
    },
  })
}

async function withHookEnv(run) {
  const previous = process.env.SUPABASE_SEND_EMAIL_HOOK_SECRET
  process.env.SUPABASE_SEND_EMAIL_HOOK_SECRET = SECRET
  try {
    return await run()
  } finally {
    if (previous === undefined)
      delete process.env.SUPABASE_SEND_EMAIL_HOOK_SECRET
    else process.env.SUPABASE_SEND_EMAIL_HOOK_SECRET = previous
  }
}

const now = () => Math.floor(Date.now() / 1000)

test("Given an ambiguous provider failure When GoTrue retries the same OTP with a new webhook-id Then no second code is minted or sent", async () => {
  await withHookEnv(async () => {
    const { POST, state } = await loadRoute()
    state.sendPlan.push("ambiguous")
    const body = otpPayload()

    const first = await POST(
      signedAttempt(body, {
        webhookId: `msg_${randomUUID()}`,
        timestamp: now(),
      })
    )
    assert.equal(first.status, 503, "an ambiguous failure asks GoTrue to retry")

    const retry = await POST(
      signedAttempt(body, {
        webhookId: `msg_${randomUUID()}`,
        timestamp: now() + 1,
      })
    )
    assert.equal(retry.status, 200)
    assert.deepEqual(await retry.json(), {})

    assert.equal(state.sends.length, 1, "Resend is called once for one OTP")
    assert.equal(state.aliases.length, 1, "one alias exists for one OTP")
    assert.equal(
      state.aliases[0].live,
      true,
      "the possibly delivered code keeps working"
    )
  })
})

test("Given a delivered OTP When a retry or replay arrives with another webhook-id Then the provider is still called once", async () => {
  await withHookEnv(async () => {
    const { POST, state } = await loadRoute()
    const body = otpPayload()

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await POST(
        signedAttempt(body, {
          webhookId: `msg_${randomUUID()}`,
          timestamp: now() + attempt,
        })
      )
      assert.equal(response.status, 200)
    }

    assert.equal(state.sends.length, 1)
    assert.equal(state.aliases.length, 1)
  })
})

test("Given a delivery still in flight When GoTrue retries Then the retry succeeds without a second send", async () => {
  await withHookEnv(async () => {
    const { POST, state } = await loadRoute()
    const body = otpPayload()
    let release
    state.hold = new Promise((resolve) => (release = resolve))

    const firstPromise = POST(
      signedAttempt(body, {
        webhookId: `msg_${randomUUID()}`,
        timestamp: now(),
      })
    )
    while (state.aliases.length === 0) {
      await new Promise((resolve) => setImmediate(resolve))
    }
    state.hold = null

    const retry = await POST(
      signedAttempt(body, {
        webhookId: `msg_${randomUUID()}`,
        timestamp: now() + 1,
      })
    )
    assert.equal(retry.status, 200, "an in-flight delivery is not retried")
    assert.deepEqual(await retry.json(), {})
    release()
    assert.equal((await firstPromise).status, 200)

    assert.equal(state.sends.length, 1)
    assert.equal(state.aliases.length, 1)
  })
})

test("Given a definitive provider rejection When GoTrue retries Then a fresh delivery may be attempted", async () => {
  await withHookEnv(async () => {
    const { POST, state } = await loadRoute()
    state.sendPlan.push("rejected", "accepted")
    const body = otpPayload()

    const first = await POST(
      signedAttempt(body, {
        webhookId: `msg_${randomUUID()}`,
        timestamp: now(),
      })
    )
    assert.equal(first.status, 503)
    const retry = await POST(
      signedAttempt(body, {
        webhookId: `msg_${randomUUID()}`,
        timestamp: now() + 1,
      })
    )
    assert.equal(retry.status, 200)

    assert.equal(state.sends.length, 2)
    assert.deepEqual(
      state.aliases.map((alias) => alias.resolution ?? "live"),
      ["delivery_failed", "live"]
    )
  })
})

test("Given two different OTPs for one user When each is delivered Then both are sent and the Resend keys differ", async () => {
  await withHookEnv(async () => {
    const { POST, state } = await loadRoute()

    for (const token of ["111111", "222222"]) {
      const response = await POST(
        signedAttempt(otpPayload({ token }), {
          webhookId: `msg_${randomUUID()}`,
          timestamp: now(),
        })
      )
      assert.equal(response.status, 200)
    }

    assert.equal(state.sends.length, 2)
    assert.notEqual(
      state.sends[0].idempotencyKey,
      state.sends[1].idempotencyKey
    )
    for (const send of state.sends) {
      assert.match(send.idempotencyKey, /^auth-hook-email:[0-9a-f]{64}$/)
      assert.ok(
        !send.idempotencyKey.includes("111111") &&
          !send.idempotencyKey.includes("222222"),
        "the provider key never carries the OTP"
      )
    }
  })
})

test("Given the stable delivery key When it is stored Then it is keyed by the hook secret and cannot be recomputed from the payload alone", async () => {
  await withHookEnv(async () => {
    const { POST, state } = await loadRoute()
    const response = await POST(
      signedAttempt(otpPayload({ token: "271828" }), {
        webhookId: `msg_${randomUUID()}`,
        timestamp: now(),
      })
    )
    assert.equal(response.status, 200)
    const [claimKey] = [...state.claims.keys()]
    assert.ok(claimKey.startsWith("email:"))
    assert.ok(!claimKey.includes("271828"))
    assert.ok(!claimKey.includes(USER_ID))
    assert.ok(!claimKey.includes("venue@example.test"))
  })
})
