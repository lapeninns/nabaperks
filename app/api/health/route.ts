import {
  REQUEST_ID_HEADER,
  resolveRequestId,
} from "@/lib/observability/request-id"

// Liveness probe for uptime monitors, load balancers, and deploy smoke checks.
// Intentionally dependency-free and never cached so a 200 here means the Next
// server is up and serving. Deeper dependency checks (DB, Stripe) belong in a
// separate, authenticated readiness probe so this stays cheap and public.
export const dynamic = "force-dynamic"

const SERVICE = "nabaperks"
const VERSION = process.env.npm_package_version ?? "0.0.0"

export async function GET(request: Request): Promise<Response> {
  const requestId = resolveRequestId(request.headers)

  return Response.json(
    {
      status: "ok",
      service: SERVICE,
      version: VERSION,
      uptime: Math.round(process.uptime()),
      time: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        "cache-control": "no-store, max-age=0",
        [REQUEST_ID_HEADER]: requestId,
      },
    }
  )
}
