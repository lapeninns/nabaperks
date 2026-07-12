export type DatabaseReadiness = {
  readonly database: "ok" | "error"
}

type ReadinessOptions = {
  readonly supabaseUrl: string | undefined
  readonly serviceRoleKey: string | undefined
  readonly fetcher?: typeof fetch
  readonly timeoutMs?: number
}

export async function checkDatabaseReadiness({
  supabaseUrl,
  serviceRoleKey,
  fetcher = fetch,
  timeoutMs = 3_000,
}: ReadinessOptions): Promise<DatabaseReadiness> {
  if (!supabaseUrl?.trim() || !serviceRoleKey?.trim()) {
    return { database: "error" }
  }

  try {
    const url = new URL(
      "/rest/v1/rpc/production_readiness_probe",
      supabaseUrl
    )

    const response = await fetcher(url, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
        "content-type": "application/json",
      },
      body: "{}",
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    })

    return { database: response.ok ? "ok" : "error" }
  } catch {
    return { database: "error" }
  }
}
