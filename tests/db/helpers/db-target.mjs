const LOCAL_DB_HOSTS = new Set(["127.0.0.1", "localhost", "::1"])

export function assertLocalSupabaseDbUrl(value) {
  const candidate = value?.trim()
  if (!candidate) return undefined

  let parsed
  try {
    parsed = new URL(candidate)
  } catch {
    throw new Error("SUPABASE_DB_URL must be a valid local PostgreSQL URL")
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "")
  if (
    !["postgres:", "postgresql:"].includes(parsed.protocol) ||
    !LOCAL_DB_HOSTS.has(hostname)
  ) {
    throw new Error(
      "Refusing database tests: SUPABASE_DB_URL must target loopback Supabase Postgres"
    )
  }

  return candidate
}
