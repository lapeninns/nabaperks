import { createHmac, randomUUID } from "node:crypto"
import { pathToFileURL } from "node:url"

const MALFORMED_PROBE_BODY = "{"
const ALTERNATE_PROBE_KEY = Buffer.alloc(32, 0x5a)

export async function checkAuthHookSecretAlignment({
  origin,
  secret,
  fetchImpl = fetch,
  now = Date.now(),
}) {
  const hookUrl = authHookUrl(origin)
  const signingKey = decodeSigningKey(secret)

  const accepted = await sendProbe({
    body: MALFORMED_PROBE_BODY,
    fetchImpl,
    hookUrl,
    key: signingKey,
    now,
  })
  if (accepted.status !== 400) {
    throw new Error(
      "The staged Auth hook did not accept the protected signing secret."
    )
  }

  const rejected = await sendProbe({
    body: MALFORMED_PROBE_BODY,
    fetchImpl,
    hookUrl,
    key: ALTERNATE_PROBE_KEY,
    now,
  })
  if (rejected.status !== 401) {
    throw new Error(
      "The staged Auth hook did not reject an alternate signing secret."
    )
  }
}

function authHookUrl(origin) {
  let parsed
  try {
    parsed = new URL(origin)
  } catch {
    throw new Error("AUTH_HOOK_CANARY_URL must be a valid HTTPS origin.")
  }

  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error("AUTH_HOOK_CANARY_URL must be a valid HTTPS origin.")
  }

  return new URL("/api/auth/hooks/send-email", parsed.origin)
}

function decodeSigningKey(secret) {
  const candidate = secret?.trim()
  if (!candidate) {
    throw new Error("SUPABASE_SEND_EMAIL_HOOK_SECRET is required.")
  }

  const match = /^v1,whsec_([A-Za-z0-9+/_-]+={0,2})$/.exec(candidate)
  if (!match) {
    throw new Error(
      "SUPABASE_SEND_EMAIL_HOOK_SECRET is not a valid protected hook secret."
    )
  }
  const encoded = match[1].replace(/-/g, "+").replace(/_/g, "/")
  const key = Buffer.from(encoded, "base64")
  if (key.length < 32) {
    throw new Error(
      "SUPABASE_SEND_EMAIL_HOOK_SECRET is not a valid protected hook secret."
    )
  }
  return key
}

async function sendProbe({ body, fetchImpl, hookUrl, key, now }) {
  const id = `msg_release_canary_${randomUUID()}`
  const timestamp = Math.floor(now / 1000).toString()
  const signature = createHmac("sha256", key)
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64")

  return fetchImpl(hookUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "webhook-id": id,
      "webhook-signature": `v1,${signature}`,
      "webhook-timestamp": timestamp,
    },
    body,
    signal: AbortSignal.timeout(15_000),
  })
}

async function main() {
  await checkAuthHookSecretAlignment({
    origin: process.env.AUTH_HOOK_CANARY_URL,
    secret: process.env.SUPABASE_SEND_EMAIL_HOOK_SECRET,
  })
  console.log("Auth hook signing-secret alignment passed.")
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  main().catch((error) => {
    console.error(
      error instanceof Error ? error.message : "Auth hook check failed."
    )
    process.exitCode = 1
  })
}
