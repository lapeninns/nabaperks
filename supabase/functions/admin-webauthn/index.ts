import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "npm:@simplewebauthn/server@14.0.0"
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from "npm:@simplewebauthn/server@14.0.0"
import { createClient } from "npm:@supabase/supabase-js@2.111.0"

const RP_ID = "nabaperks.com"
const RP_NAME = "Nabaperks"
const ALLOWED_ORIGINS = new Set([
  "https://nabaperks.com",
  "https://mfa.nabaperks.com",
])
const JSON_HEADERS = {
  "cache-control": "no-store, max-age=0",
  "content-type": "application/json",
  "x-content-type-options": "nosniff",
}

type ChallengeRecord = {
  id: string
  userId: string
  sessionId: string
  purpose: "registration" | "authentication"
  challenge: string
  origin: string
  credentialRecordId: string | null
  credentialId: string | null
  publicKey: string | null
  counter: number | null
  transports: string[] | null
  deviceType: "singleDevice" | "multiDevice" | null
  backedUp: boolean | null
}

function response(origin: string, status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...JSON_HEADERS,
      "access-control-allow-origin": origin,
      vary: "Origin",
    },
  })
}

function randomChallenge() {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return encodeBase64Url(bytes)
}

function encodeBase64Url(bytes: Uint8Array) {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "")
}

function decodeBase64Url(value: string) {
  const normalised = value.replaceAll("-", "+").replaceAll("_", "/")
  const binary = atob(
    normalised.padEnd(Math.ceil(normalised.length / 4) * 4, "=")
  )
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  )
}

async function readBody(request: Request) {
  const bytes = new Uint8Array(await request.arrayBuffer())
  if (bytes.length < 1 || bytes.length > 32_768) {
    throw new Error("invalid_body")
  }
  const body = JSON.parse(
    new TextDecoder("utf-8", { fatal: true }).decode(bytes)
  )
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("invalid_body")
  }
  return body as Record<string, unknown>
}

Deno.serve(async (request) => {
  const origin = request.headers.get("origin") ?? ""
  if (!ALLOWED_ORIGINS.has(origin)) {
    return new Response(null, { status: 403 })
  }
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-headers": "authorization, apikey, content-type",
        "access-control-allow-methods": "POST, OPTIONS",
        "access-control-allow-origin": origin,
        "access-control-max-age": "600",
        vary: "Origin",
      },
    })
  }
  if (request.method !== "POST") {
    return response(origin, 405, { ok: false, error: "method_not_allowed" })
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  const authorization = request.headers.get("authorization") ?? ""
  if (
    !supabaseUrl ||
    !anonKey ||
    !serviceRoleKey ||
    !authorization.startsWith("Bearer ")
  ) {
    return response(origin, 401, {
      ok: false,
      error: "authentication_required",
    })
  }

  const token = authorization.slice(7)
  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
    global: { headers: { authorization } },
  })
  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  try {
    const [{ data: authData, error: authError }, body] = await Promise.all([
      userClient.auth.getUser(token),
      readBody(request),
    ])
    if (authError || !authData.user) {
      return response(origin, 401, {
        ok: false,
        error: "authentication_required",
      })
    }

    switch (body.action) {
      case "registration-options": {
        const challenge = randomChallenge()
        const { data: challengeId, error } = await userClient.rpc(
          "begin_admin_webauthn_challenge",
          {
            p_challenge: challenge,
            p_origin: origin,
            p_purpose: "registration",
          }
        )
        if (error || !isUuid(challengeId))
          throw new Error("registration_not_available")
        const options = await generateRegistrationOptions({
          rpID: RP_ID,
          rpName: RP_NAME,
          userID: new TextEncoder().encode(authData.user.id),
          userName: authData.user.email ?? authData.user.id,
          userDisplayName: "Nabaperks administrator",
          challenge,
          timeout: 300_000,
          attestationType: "none",
          authenticatorSelection: {
            residentKey: "preferred",
            userVerification: "required",
          },
        })
        return response(origin, 200, { ok: true, challengeId, options })
      }
      case "authentication-options": {
        const challenge = randomChallenge()
        const { data: challengeId, error } = await userClient.rpc(
          "begin_admin_webauthn_challenge",
          {
            p_challenge: challenge,
            p_origin: origin,
            p_purpose: "authentication",
          }
        )
        if (error || !isUuid(challengeId))
          throw new Error("authentication_not_available")
        const record = await readChallenge(serviceClient, challengeId, false)
        if (!record.credentialId) throw new Error("credential_not_available")
        const options = await generateAuthenticationOptions({
          rpID: RP_ID,
          challenge,
          timeout: 300_000,
          userVerification: "required",
          allowCredentials: [
            {
              id: record.credentialId,
              transports: record.transports ?? undefined,
            },
          ],
        })
        return response(origin, 200, { ok: true, challengeId, options })
      }
      case "registration-verify": {
        if (!isUuid(body.challengeId) || !body.response)
          throw new Error("invalid_request")
        await consumeChallenge(
          userClient,
          body.challengeId,
          "registration",
          origin
        )
        const record = await readChallenge(
          serviceClient,
          body.challengeId,
          true
        )
        const verification = await verifyRegistrationResponse({
          response: body.response as RegistrationResponseJSON,
          expectedChallenge: record.challenge,
          expectedOrigin: record.origin,
          expectedRPID: RP_ID,
          requireUserPresence: true,
          requireUserVerification: true,
        })
        if (
          !verification.verified ||
          !verification.registrationInfo.userVerified
        ) {
          throw new Error("verification_failed")
        }
        const info = verification.registrationInfo
        const { data: credentialId, error } = await serviceClient.rpc(
          "register_admin_webauthn_credential",
          {
            p_backed_up: info.credentialBackedUp,
            p_challenge_id: body.challengeId,
            p_counter: info.credential.counter,
            p_credential_id: info.credential.id,
            p_device_type: info.credentialDeviceType,
            p_public_key: encodeBase64Url(info.credential.publicKey),
            p_transports: info.credential.transports ?? [],
            p_user_verified: info.userVerified,
          }
        )
        if (error || !isUuid(credentialId))
          throw new Error("credential_save_failed")
        return response(origin, 200, { ok: true })
      }
      case "authentication-verify": {
        if (!isUuid(body.challengeId) || !body.response)
          throw new Error("invalid_request")
        await consumeChallenge(
          userClient,
          body.challengeId,
          "authentication",
          origin
        )
        const record = await readChallenge(
          serviceClient,
          body.challengeId,
          true
        )
        if (
          !record.credentialId ||
          !record.publicKey ||
          record.counter === null ||
          !record.deviceType ||
          record.backedUp === null
        ) {
          throw new Error("credential_not_available")
        }
        const verification = await verifyAuthenticationResponse({
          response: body.response as AuthenticationResponseJSON,
          expectedChallenge: record.challenge,
          expectedOrigin: record.origin,
          expectedRPID: RP_ID,
          requireUserVerification: true,
          advancedFIDOConfig: { userVerification: "required" },
          credential: {
            id: record.credentialId,
            publicKey: decodeBase64Url(record.publicKey),
            counter: record.counter,
            transports: record.transports ?? undefined,
          },
        })
        if (
          !verification.verified ||
          !verification.authenticationInfo.userVerified
        ) {
          throw new Error("verification_failed")
        }
        const { data: granted, error } = await serviceClient.rpc(
          "grant_admin_webauthn_session",
          {
            p_challenge_id: body.challengeId,
            p_credential_id: verification.authenticationInfo.credentialID,
            p_expected_counter: record.counter,
            p_new_counter: verification.authenticationInfo.newCounter,
            p_user_verified: verification.authenticationInfo.userVerified,
          }
        )
        if (error || granted !== true) throw new Error("grant_failed")
        return response(origin, 200, { ok: true })
      }
      default:
        return response(origin, 400, { ok: false, error: "invalid_action" })
    }
  } catch {
    return response(origin, 400, {
      ok: false,
      error: "webauthn_request_failed",
    })
  }
})

async function consumeChallenge(
  client: ReturnType<typeof createClient>,
  challengeId: string,
  purpose: "registration" | "authentication",
  origin: string
) {
  const { data, error } = await client.rpc(
    "consume_viewer_admin_webauthn_challenge",
    { p_challenge_id: challengeId, p_origin: origin, p_purpose: purpose }
  )
  if (error || data !== true) throw new Error("challenge_unavailable")
}

async function readChallenge(
  client: ReturnType<typeof createClient>,
  challengeId: string,
  requireConsumed: boolean
) {
  const { data, error } = await client.rpc("read_admin_webauthn_challenge", {
    p_challenge_id: challengeId,
    p_require_consumed: requireConsumed,
  })
  if (error || !data || typeof data !== "object")
    throw new Error("challenge_unavailable")
  return data as ChallengeRecord
}
