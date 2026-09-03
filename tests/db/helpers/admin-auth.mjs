import { randomUUID } from "node:crypto"

/**
 * Provision the trusted half of an internal-admin test fixture.
 *
 * AAL2 alone is not authority: production activation binds one independently
 * approved verified factor to the admin row. Tests that exercise legitimate
 * admin behaviour must model that lifecycle explicitly instead of weakening
 * `public.is_internal_admin()` or hiding activation in the global DB harness.
 */
export async function ensureActivatedInternalAdmin(tx, userId) {
  const [admin] = await tx`
    select mfa_factor_id::text as mfa_factor_id
    from public.internal_admins
    where user_id = ${userId}::uuid
      and is_active = true`

  if (!admin) {
    throw new Error(`Active internal-admin fixture is missing for ${userId}`)
  }

  if (admin.mfa_factor_id) {
    const [bound] = await tx`
      select id::text as id
      from auth.mfa_factors
      where id = ${admin.mfa_factor_id}::uuid
        and user_id = ${userId}::uuid
        and factor_type = 'webauthn'
        and status = 'verified'`
    if (!bound) {
      throw new Error(`Internal-admin fixture has an invalid MFA binding`)
    }
    return bound.id
  }

  const verifiedFactors = await tx`
    select id::text as id
    from auth.mfa_factors
    where user_id = ${userId}::uuid
      and factor_type = 'webauthn'
      and status = 'verified'`
  if (verifiedFactors.length > 1) {
    throw new Error(`Internal-admin fixture has multiple verified factors`)
  }

  let factorId = verifiedFactors[0]?.id
  if (!factorId) {
    factorId = randomUUID()
    await tx`
      insert into auth.mfa_factors
        (id, user_id, friendly_name, factor_type, status,
         web_authn_credential, created_at, updated_at)
      values (
        ${factorId}::uuid,
        ${userId}::uuid,
        ${`db-test-webauthn-${factorId}`},
        'webauthn',
        'verified',
        jsonb_build_object(
          'flags', jsonb_build_object('userVerified', true)
        ),
        now(),
        now()
      )`
  }
  const [{ priorRole }] = await tx`
    select current_setting('request.jwt.claim.role', true) as "priorRole"`
  try {
    await tx`select set_config('request.jwt.claim.role', 'service_role', true)`
    await tx`
      select public.activate_internal_admin_mfa(
        ${userId}::uuid, ${factorId}::uuid
      )`
  } finally {
    await tx`
      select set_config(
        'request.jwt.claim.role',
        ${priorRole ?? ""},
        true
      )`
  }

  return factorId
}

export async function actAsActivatedInternalAdmin(tx, userId) {
  const factorId = await ensureActivatedInternalAdmin(tx, userId)
  const [activation] = await tx`
    select mfa_activated_at
    from public.internal_admins
    where user_id = ${userId}::uuid`
  if (!activation?.mfa_activated_at) {
    throw new Error(`Internal-admin fixture has no activation epoch`)
  }

  const sessionId = randomUUID()
  const challengedAt = new Date(
    new Date(activation.mfa_activated_at).getTime() + 1_000
  )
  await recordWebAuthnAssertion(tx, factorId, true)
  await tx`
    insert into auth.sessions
      (id, user_id, created_at, updated_at, factor_id, aal)
    values (
      ${sessionId}::uuid,
      ${userId}::uuid,
      ${challengedAt},
      ${challengedAt},
      ${factorId}::uuid,
      'aal2'::auth.aal_level
    )`
  await tx`
    insert into auth.mfa_amr_claims
      (id, session_id, created_at, updated_at, authentication_method)
    values (
      ${randomUUID()}::uuid,
      ${sessionId}::uuid,
      ${challengedAt},
      ${challengedAt},
      'mfa/webauthn'
    )`
  const claimValues = {
    sub: userId,
    role: "authenticated",
    aal: "aal2",
    session_id: sessionId,
    amr: [
      {
        method: "mfa/webauthn",
        timestamp: Math.floor(challengedAt.getTime() / 1_000),
      },
    ],
  }
  const claims = JSON.stringify(claimValues)
  await tx`select set_config('request.jwt.claim.role', 'authenticated', true)`
  await tx`select set_config('request.jwt.claim.sub', ${userId}, true)`
  await tx`select set_config('request.jwt.claim.aal', 'aal2', true)`
  await tx`select set_config('request.jwt.claims', ${claims}, true)`
  return claimValues
}

export async function recordWebAuthnAssertion(tx, factorId, userVerified) {
  const flags = userVerified ? 5 : 1
  await tx`
    update auth.mfa_factors
    set last_webauthn_challenge_data = jsonb_build_object(
          'type', 'request',
          'credential_response', jsonb_build_object(
            'Response', jsonb_build_object(
              'AuthenticatorData', jsonb_build_object('flags', ${flags}::integer)
            )
          )
        ),
        updated_at = now()
    where id = ${factorId}::uuid`
}
