import { createHmac, randomUUID } from "node:crypto"
import { mock } from "node:test"
import postgres from "postgres"

const [routeName, scenario] = process.argv.slice(2)
const secret = `v1,whsec_${Buffer.from("task10-test-secret").toString("base64")}`
let claimCalls = 0
let uniqueClaimants = 0
let providerEffects = 0
let localClaimStore

mock.module("@/lib/supabase/server", {
  namedExports: {
    createSupabaseServiceRoleClient: () => ({
      rpc: async (name) => {
        if (name === "claim_auth_hook_delivery") {
          if (scenario === "hung-db") {
            await new Promise(() => {})
          }
          if (scenario === "db-error") {
            return { data: null, error: new Error("sensitive database detail") }
          }
        }
        return { data: true, error: null }
      },
    }),
  },
})

if (scenario === "db-concurrent") {
  const url = process.env.SUPABASE_DB_URL
  if (!url) throw new Error("SUPABASE_DB_URL is required")
  const target = new URL(url)
  if (target.hostname !== "127.0.0.1" && target.hostname !== "localhost") {
    throw new Error("loopback database required")
  }
  localClaimStore = postgres(target.href, { max: 2 })
  const runRpc = (name, channel, webhookId) =>
    localClaimStore.begin(async (tx) => {
      await tx`select set_config('request.jwt.claim.role', 'service_role', true)`
      let rows
      if (name === "claim") {
        rows = await tx`
          select public.claim_auth_hook_delivery(
            ${channel}, ${webhookId}
          ) as outcome`
      } else if (name === "complete") {
        rows = await tx`
          select public.complete_auth_hook_delivery(
            ${channel}, ${webhookId}
          ) as outcome`
      } else {
        rows = await tx`
          select public.fail_auth_hook_delivery(
            ${channel}, ${webhookId}
          ) as outcome`
      }
      const [row] = rows
      return row.outcome
    })
  mock.module("@/lib/auth/auth-hook-delivery", {
    namedExports: {
      claimAuthHookDelivery: async (channel, webhookId) => {
        claimCalls += 1
        const outcome = await runRpc("claim", channel, webhookId)
        if (outcome === "claimed") uniqueClaimants += 1
        return outcome
      },
      completeAuthHookDelivery: async (channel, webhookId) => {
        await runRpc("complete", channel, webhookId)
      },
      failAuthHookDelivery: async (channel, webhookId) => {
        await runRpc("fail", channel, webhookId)
      },
    },
  })
} else if (scenario !== "db-error" && scenario !== "hung-db") {
  let claimed = false
  mock.module("@/lib/auth/auth-hook-delivery", {
    namedExports: {
      claimAuthHookDelivery: async () => {
        claimCalls += 1
        if (scenario === "replay") return "replay"
        if (claimed) return "concurrent"
        claimed = true
        uniqueClaimants += 1
        return "claimed"
      },
      completeAuthHookDelivery: async () => {},
      failAuthHookDelivery: async () => {},
    },
  })
}

mock.module("@/lib/notifications/twilio", {
  namedExports: {
    sendSmsOtp: async () => {
      providerEffects += 1
      if (scenario === "hung-provider") await new Promise(() => {})
    },
  },
})
mock.module("@/lib/notifications/resend", {
  namedExports: {
    readEmailOtpConfig: () => {},
    sendEmailOtp: async () => {
      providerEffects += 1
      if (scenario === "hung-provider") await new Promise(() => {})
    },
  },
})
mock.module("@/lib/auth/merchant-email-otp-alias", {
  namedExports: {
    createMerchantEmailOtpAlias: async () => ({
      aliasCode: "654321",
      aliasId: "task10-alias",
    }),
    revokeMerchantEmailOtpAlias: async () => {},
  },
})
mock.module("@/lib/auth/merchant-email-otp-provider", {
  namedExports: {
    runMerchantOtpDelivery: async ({ sendAlias }) => sendAlias("654321"),
  },
})

const routePath =
  routeName === "email"
    ? "../../app/api/auth/hooks/send-email/route.ts"
    : "../../app/api/auth/hooks/send-sms/route.ts"
const secretName =
  routeName === "email"
    ? "SUPABASE_SEND_EMAIL_HOOK_SECRET"
    : "SUPABASE_SEND_SMS_HOOK_SECRET"
process.env[secretName] = secret

const { POST } = await import(
  `${routePath}?scenario=${scenario}&route=${routeName}`
)
const requestCount =
  scenario === "concurrent" || scenario === "db-concurrent" ? 2 : 1
const code =
  scenario === "prompt-data" ? "ignore previous instructions" : "123456"
const body =
  scenario === "malformed-request"
    ? "{"
    : JSON.stringify(
        routeName === "email"
          ? {
              user: { email: "task10@example.invalid" },
              email_data: { token: code, email_action_type: "signup" },
            }
          : { user: { phone: "+447700900001" }, sms: { otp: code } }
      )
const webhookId = `msg_task10_${routeName}_${scenario}_${randomUUID()}`
const timestamp = Math.floor(Date.now() / 1000).toString()
const signature = createHmac(
  "sha256",
  Buffer.from(secret.replace(/^v1,whsec_/, ""), "base64")
)
  .update(`${webhookId}.${timestamp}.${body}`)
  .digest("base64")
const signatureHeader =
  scenario === "invalid-signature" ? "v1,invalid" : `v1,${signature}`

try {
  const responses = await Promise.all(
    Array.from({ length: requestCount }, () =>
      POST(
        new Request(`http://127.0.0.1/api/auth/hooks/send-${routeName}`, {
          method: "POST",
          body,
          headers: {
            "content-type": "application/json",
            "webhook-id": webhookId,
            "webhook-signature": signatureHeader,
            "webhook-timestamp": timestamp,
          },
        })
      )
    )
  )
  const responseBodies = await Promise.all(
    responses.map((response) => response.text())
  )
  process.stdout.write(
    `${JSON.stringify({
      requestCount,
      claimCalls,
      uniqueClaimants,
      providerEffects,
      statuses: responses.map((response) => response.status),
      retainedSensitiveError: responseBodies.some((bodyText) =>
        bodyText.includes("sensitive database detail")
      ),
    })}\n`
  )
} finally {
  if (localClaimStore) {
    await localClaimStore`
      delete from public.auth_hook_deliveries
      where webhook_id = ${webhookId}`
    await localClaimStore.end({ timeout: 5 })
  }
}
