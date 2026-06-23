import { NextResponse, type NextRequest } from "next/server"

// NOTE: this handler must never import a browser binary. Chromium runs only on
// the separate worker; the cron simply triggers that worker's drain.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NO_STORE = { "cache-control": "no-store, max-age=0" }

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401, headers: NO_STORE }
    )
  }

  const workerUrl = process.env.QR_ASSET_WORKER_URL?.trim()
  if (!workerUrl) {
    // No external worker configured (e.g. it self-polls Postgres) — the cron is
    // a harmless heartbeat. Assets still generate via the worker's own loop.
    return NextResponse.json(
      { ok: true, triggered: false, reason: "worker_url_unset" },
      { headers: NO_STORE }
    )
  }

  try {
    const response = await fetch(`${workerUrl.replace(/\/$/, "")}/drain`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.QR_ASSET_WORKER_TOKEN ?? ""}`,
        "content-type": "application/json",
      },
    })
    return NextResponse.json(
      { ok: true, triggered: true, status: response.status },
      { headers: NO_STORE }
    )
  } catch {
    return NextResponse.json(
      { ok: true, triggered: false, reason: "worker_unreachable" },
      { headers: NO_STORE }
    )
  }
}

function isAuthorizedCronRequest(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return process.env.NODE_ENV !== "production"

  return request.headers.get("authorization") === `Bearer ${secret}`
}
