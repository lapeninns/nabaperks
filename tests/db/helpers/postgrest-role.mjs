/** Exercise the real authenticator/session_user boundary, not just JWT GUCs. */
export async function asPostgrestRole(tx, role, claims, fn) {
  if (!["anon", "authenticated", "service_role"].includes(role)) {
    throw new Error("Unsupported test role")
  }
  const [previous] = await tx`select
    current_setting('request.jwt.claim.role', true) as role,
    current_setting('request.jwt.claim.sub', true) as sub,
    current_setting('request.jwt.claim.aal', true) as aal,
    current_setting('request.jwt.claims', true) as claims`
  await tx.unsafe("set session authorization authenticator")
  await tx.unsafe(`set local role ${role}`)
  try {
    await tx`select set_config('request.jwt.claim.role', ${role}, true)`
    await tx`select set_config('request.jwt.claim.sub', ${claims.sub ?? ""}, true)`
    await tx`select set_config('request.jwt.claim.aal', ${claims.aal ?? "aal1"}, true)`
    await tx`select set_config('request.jwt.claims', ${JSON.stringify({ role, amr: [{ method: "otp" }], ...claims })}, true)`
    return await tx.savepoint((sp) => fn(sp))
  } finally {
    await tx.unsafe("reset role")
    await tx.unsafe("reset session authorization")
    await tx`select
      set_config('request.jwt.claim.role', ${previous.role ?? ""}, true),
      set_config('request.jwt.claim.sub', ${previous.sub ?? ""}, true),
      set_config('request.jwt.claim.aal', ${previous.aal ?? ""}, true),
      set_config('request.jwt.claims', ${previous.claims ?? ""}, true)`
  }
}
