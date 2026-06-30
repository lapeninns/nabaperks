import postgres from "postgres"

import {
  errorMessage,
  getJson,
  isLocalUrl,
  originLabel,
  shouldRequireSsl,
  value,
} from "./runtime.mjs"

const remediationRpcs = [
  "admin_export_customer_data",
  "admin_erase_customer_pii",
  "admin_purge_stale_customer_pii",
  "admin_resolve_fraud_flag",
  "claim_due_notification_events",
  "purge_expired_reward_scan_tokens",
  "purge_merchant_email_otp_aliases",
  "reconcile_loyalty_card_threshold_rewards",
  "record_notification_delivery",
  "register_push_subscription_for_customer",
]

export async function runReadinessChecks({ env, offline, report }) {
  await checkSupabaseTarget({ env, offline, report })
  await checkStripe({ env, offline, report })
  await checkTwilio({ env, offline, report })
  await checkResend({ env, offline, report })
  checkCronAndHooks({ env, report })
  checkWebPush({ env, report })
  checkPostHog({ env, report })
}

async function checkSupabaseTarget({ env, offline, report }) {
  const supabaseUrl = value(env, "NEXT_PUBLIC_SUPABASE_URL")
  const dbUrl = value(env, "SUPABASE_DB_URL")

  if (!supabaseUrl) {
    report.fail("supabase-url", "NEXT_PUBLIC_SUPABASE_URL is missing.")
  } else if (isLocalUrl(supabaseUrl)) {
    report.blocked(
      "supabase-url",
      "NEXT_PUBLIC_SUPABASE_URL points at local Supabase; target project proof is still missing."
    )
  } else {
    report.pass("supabase-url", `configured for ${originLabel(supabaseUrl)}.`)
  }

  if (!dbUrl) {
    report.fail("supabase-db", "SUPABASE_DB_URL is missing; cannot inspect RPC rollout.")
    return
  }

  if (isLocalUrl(dbUrl)) {
    report.blocked(
      "supabase-db",
      "SUPABASE_DB_URL points at local Postgres; hosted migration proof is still missing."
    )
  } else {
    report.pass("supabase-db", `configured for ${originLabel(dbUrl)}.`)
  }

  if (offline) {
    report.blocked("supabase-rpcs", "offline mode skipped RPC presence query.")
    return
  }

  await checkRemediationRpcs(dbUrl, report)
}

async function checkRemediationRpcs(dbUrl, report) {
  const sql = postgres(dbUrl, {
    max: 1,
    idle_timeout: 5,
    ssl: shouldRequireSsl(dbUrl) ? "require" : undefined,
  })

  try {
    const rows = await sql`
      select proname
      from pg_proc
      where proname in ${sql(remediationRpcs)}
    `
    const found = new Set(rows.map((row) => row.proname))
    const missing = remediationRpcs.filter((name) => !found.has(name))

    if (missing.length > 0) {
      report.fail("supabase-rpcs", `missing RPC(s): ${missing.join(", ")}.`)
    } else {
      report.pass("supabase-rpcs", "remediation RPCs are present in the configured database.")
    }
  } catch (error) {
    report.fail("supabase-rpcs", `RPC presence query failed: ${errorMessage(error)}.`)
  } finally {
    await sql.end({ timeout: 5 })
  }
}

async function checkStripe({ env, offline, report }) {
  const apiKey = value(env, "STRIPE_SECRET_KEY")
  const priceId = value(env, "STRIPE_GROWTH_PRICE_ID")
  const webhookSecret = value(env, "STRIPE_WEBHOOK_SECRET")

  if (!apiKey) report.fail("stripe-api", "STRIPE_SECRET_KEY is missing.")
  if (!priceId) report.fail("stripe-price", "STRIPE_GROWTH_PRICE_ID is missing.")
  if (!webhookSecret) report.fail("stripe-webhook-secret", "STRIPE_WEBHOOK_SECRET is missing.")
  if (!apiKey || !priceId) return

  if (offline) {
    report.blocked("stripe-price", "offline mode skipped Stripe Price lookup.")
  } else {
    await checkStripePrice({ apiKey, priceId, report })
  }

  report.blocked(
    "stripe-webhook-replay",
    "read-only smoke did not replay Stripe events into a deployed route."
  )
}

async function checkStripePrice({ apiKey, priceId, report }) {
  const price = await getJson(
    `https://api.stripe.com/v1/prices/${encodeURIComponent(priceId)}`,
    { Authorization: `Bearer ${apiKey}` }
  )

  if (!price.ok) {
    report.fail("stripe-price", `Stripe Price lookup failed with HTTP ${price.status}.`)
    return
  }

  const body = price.body
  const matchesPlan =
    body.id === priceId &&
    body.active === true &&
    body.currency === "gbp" &&
    body.unit_amount === 2900 &&
    body.recurring?.interval === "month"

  if (matchesPlan) {
    report.pass("stripe-price", "Growth price is active GBP 29/month.")
  } else {
    report.fail("stripe-price", "Growth price does not match active GBP 29/month.")
  }
}

async function checkTwilio({ env, offline, report }) {
  const accountSid = value(env, "TWILIO_ACCOUNT_SID")
  const verifyServiceSid = value(env, "TWILIO_VERIFY_SERVICE_SID")
  const auth = twilioAuth({
    accountSid,
    apiKeySid: value(env, "TWILIO_API_KEY_SID"),
    apiKeySecret: value(env, "TWILIO_API_KEY_SECRET"),
    authToken: value(env, "TWILIO_AUTH_TOKEN"),
  })

  requireValue(env, report, "TWILIO_ACCOUNT_SID", "twilio-account")
  if (!verifyServiceSid) report.fail("twilio-verify-service", "TWILIO_VERIFY_SERVICE_SID is missing.")
  if (!auth) {
    report.fail(
      "twilio-auth",
      "TWILIO_AUTH_TOKEN or TWILIO_API_KEY_SID/TWILIO_API_KEY_SECRET is missing."
    )
  }
  if (!accountSid || !auth || !verifyServiceSid) return

  if (offline) {
    report.blocked("twilio-verify-service", "offline mode skipped Twilio Verify lookup.")
  } else {
    await checkTwilioVerify({ verifyServiceSid, auth, report })
  }

  report.blocked("twilio-otp-send", "read-only smoke did not send a test OTP.")
}

async function checkTwilioVerify({ verifyServiceSid, auth, report }) {
  const verify = await getJson(
    `https://verify.twilio.com/v2/Services/${encodeURIComponent(verifyServiceSid)}`,
    { Authorization: auth }
  )

  if (verify.ok && verify.body.sid === verifyServiceSid) {
    report.pass("twilio-verify-service", "Twilio Verify service is readable.")
  } else {
    report.fail(
      "twilio-verify-service",
      `Twilio Verify service lookup failed with HTTP ${verify.status}.`
    )
  }
}

async function checkResend({ env, offline, report }) {
  const apiKey = value(env, "RESEND_API_KEY")
  const from = value(env, "RESEND_FROM")

  if (!apiKey) report.fail("resend-api", "RESEND_API_KEY is missing.")
  if (!from) report.fail("resend-from", "RESEND_FROM is missing.")
  if (!apiKey) return

  if (offline) {
    report.blocked("resend-api", "offline mode skipped Resend domain lookup.")
  } else {
    const domains = await getJson("https://api.resend.com/domains", {
      Authorization: `Bearer ${apiKey}`,
    })
    if (domains.ok) {
      report.pass("resend-api", "Resend API credentials are accepted.")
    } else {
      report.fail(
        "resend-api",
        `Resend domain lookup failed with HTTP ${domains.status}.`
      )
    }
  }

  report.blocked("resend-email-send", "read-only smoke did not send a test email.")
}

function checkCronAndHooks({ env, report }) {
  requireValue(env, report, "CRON_SECRET", "vercel-cron-secret")
  requireValue(env, report, "SUPABASE_SEND_EMAIL_HOOK_SECRET", "supabase-email-hook-secret")

  if (value(env, "SUPABASE_SEND_SMS_HOOK_SECRET")) {
    report.pass("supabase-sms-hook-secret", "legacy SMS hook secret is configured.")
  } else {
    report.blocked(
      "supabase-sms-hook-secret",
      "legacy SMS hook secret is missing; acceptable only if the hook is not enabled in Supabase."
    )
  }

  report.blocked("vercel-cron-run", "read-only smoke did not call bearer-protected cron routes.")
  report.blocked("supabase-auth-hooks", "read-only smoke did not trigger Supabase auth hook delivery.")
}

function checkWebPush({ env, report }) {
  if (
    value(env, "WEB_PUSH_VAPID_PUBLIC_KEY") &&
    value(env, "WEB_PUSH_VAPID_PRIVATE_KEY") &&
    value(env, "WEB_PUSH_VAPID_SUBJECT")
  ) {
    report.pass("web-push-vapid", "VAPID public/private key and subject are configured.")
  } else {
    report.fail(
      "web-push-vapid",
      "WEB_PUSH_VAPID_PUBLIC_KEY, WEB_PUSH_VAPID_PRIVATE_KEY, and WEB_PUSH_VAPID_SUBJECT are required for provider proof."
    )
  }

  report.blocked("web-push-delivery", "read-only smoke did not deliver a Web Push message.")
}

function checkPostHog({ env, report }) {
  const key = value(env, "NEXT_PUBLIC_POSTHOG_KEY")
  const host = value(env, "NEXT_PUBLIC_POSTHOG_HOST")

  if (!key || !host) {
    report.fail("posthog-config", "NEXT_PUBLIC_POSTHOG_KEY/NEXT_PUBLIC_POSTHOG_HOST are missing.")
    return
  }

  try {
    new URL(host)
    report.pass("posthog-config", "PostHog browser analytics config is present.")
  } catch {
    report.fail("posthog-config", "NEXT_PUBLIC_POSTHOG_HOST is not a valid URL.")
    return
  }

  report.blocked("posthog-capture", "read-only smoke did not write a staging analytics event.")
}

function requireValue(env, report, name, gate) {
  if (value(env, name)) {
    report.pass(gate, `${name} is configured.`)
  } else {
    report.fail(gate, `${name} is missing.`)
  }
}

function twilioAuth({ accountSid, apiKeySid, apiKeySecret, authToken }) {
  if (apiKeySid && apiKeySecret) {
    return `Basic ${Buffer.from(`${apiKeySid}:${apiKeySecret}`).toString("base64")}`
  }
  if (accountSid && authToken) {
    return `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`
  }
  return ""
}
