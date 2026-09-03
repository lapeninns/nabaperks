import { randomUUID } from "node:crypto"

/** Provision an independently activated application WebAuthn credential. */
export async function ensureActivatedInternalAdmin(tx, userId) {
  const [admin] = await tx`
    select mfa_factor_id::text as mfa_factor_id
    from public.internal_admins
    where user_id = ${userId}::uuid and is_active = true`
  if (!admin) throw new Error(`Active internal-admin fixture is missing`)

  if (admin.mfa_factor_id) {
    const [bound] = await tx`
      select id::text as id
      from public.admin_webauthn_credentials
      where id = ${admin.mfa_factor_id}::uuid
        and user_id = ${userId}::uuid
        and revoked_at is null
        and user_verified`
    if (!bound)
      throw new Error(`Internal-admin fixture has an invalid MFA binding`)
    return bound.id
  }

  const live = await tx`
    select id::text as id
    from public.admin_webauthn_credentials
    where user_id = ${userId}::uuid and revoked_at is null`
  if (live.length > 1)
    throw new Error(`Internal-admin fixture has multiple credentials`)

  let credentialId = live[0]?.id
  if (!credentialId) {
    credentialId = randomUUID()
    const opaqueId = `db_test_${credentialId.replaceAll("-", "")}`
    await tx`
      insert into public.admin_webauthn_credentials (
        id, user_id, credential_id, public_key, counter, transports,
        device_type, backed_up, user_verified
      ) values (
        ${credentialId}::uuid, ${userId}::uuid, ${opaqueId},
        ${`db_public_key_${credentialId.replaceAll("-", "")}`}, 0,
        '["internal"]'::jsonb, 'singleDevice', false, true
      )`
  }

  const [{ priorRole }] = await tx`
    select current_setting('request.jwt.claim.role', true) as "priorRole"`
  try {
    await tx`select set_config('request.jwt.claim.role', 'service_role', true)`
    await tx`
      select public.activate_internal_admin_mfa(
        ${userId}::uuid, ${credentialId}::uuid
      )`
  } finally {
    await tx`select set_config('request.jwt.claim.role', ${priorRole ?? ""}, true)`
  }
  return credentialId
}

/** Act as an admin whose current live Auth session has a fresh WebAuthn grant. */
export async function actAsActivatedInternalAdmin(tx, userId) {
  const credentialId = await ensureActivatedInternalAdmin(tx, userId)
  const sessionId = randomUUID()
  await tx`
    insert into auth.sessions (id, user_id, created_at, updated_at, aal)
    values (
      ${sessionId}::uuid, ${userId}::uuid, clock_timestamp(),
      clock_timestamp(), 'aal1'::auth.aal_level
    )`
  await tx`
    insert into public.admin_webauthn_grants (
      user_id, session_id, credential_id, verified_at, expires_at
    ) values (
      ${userId}::uuid, ${sessionId}::uuid, ${credentialId}::uuid,
      clock_timestamp(), clock_timestamp() + interval '10 minutes'
    )`

  const claims = {
    sub: userId,
    role: "authenticated",
    aal: "aal1",
    session_id: sessionId,
    amr: [{ method: "otp", timestamp: Math.floor(Date.now() / 1_000) }],
  }
  await tx`select set_config('request.jwt.claim.role', 'authenticated', true)`
  await tx`select set_config('request.jwt.claim.sub', ${userId}, true)`
  await tx`select set_config('request.jwt.claim.aal', 'aal1', true)`
  await tx`select set_config('request.jwt.claims', ${JSON.stringify(claims)}, true)`
  return claims
}
