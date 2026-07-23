export type DatabaseReadiness = {
  readonly database: "ok" | "error"
}

type ReadinessOptions = {
  readonly supabaseUrl: string | undefined
  readonly serviceRoleKey: string | undefined
  readonly allowLoopback?: boolean
  readonly fetcher?: typeof fetch
  readonly timeoutMs?: number
}

export async function checkDatabaseReadiness({
  supabaseUrl,
  serviceRoleKey,
  allowLoopback = false,
  fetcher = fetch,
  timeoutMs = 3_000,
}: ReadinessOptions): Promise<DatabaseReadiness> {
  if (!supabaseUrl?.trim() || !serviceRoleKey?.trim()) {
    return { database: "error" }
  }

  try {
    const origin = trustedSupabaseProjectOrigin(supabaseUrl, {
      allowLoopback,
    })
    if (!origin) return { database: "error" }

    const url = new URL("/rest/v1/rpc/production_readiness_probe", origin)

    const response = await fetcher(url, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
        "content-type": "application/json",
      },
      body: "{}",
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(timeoutMs),
    })

    return { database: response.ok ? "ok" : "error" }
  } catch {
    return { database: "error" }
  }
}

export function trustedSupabaseProjectOrigin(
  rawUrl: string,
  { allowLoopback = false }: { readonly allowLoopback?: boolean } = {}
): string | null {
  try {
    const url = new URL(rawUrl.trim())
    const labels = url.hostname.toLowerCase().split(".")
    const hostedProject =
      labels.length === 3 &&
      labels[1] === "supabase" &&
      labels[2] === "co" &&
      /^[a-z0-9-]+$/.test(labels[0])
    const ephemeralLoopback =
      allowLoopback && url.href === "http://127.0.0.1:54321/"

    if (
      !((url.protocol === "https:" && hostedProject) || ephemeralLoopback) ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      return null
    }

    return url.origin
  } catch {
    return null
  }
}
