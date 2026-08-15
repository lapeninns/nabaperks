import {
  REQUEST_ID_HEADER,
  resolveRequestId,
} from "@/lib/observability/request-id"
import packageJson from "@/package.json"

export const dynamic = "force-dynamic"

const SERVICE = "nabaperks"
const VERSION = packageJson.version

export async function GET(request: Request): Promise<Response> {
  const requestId = resolveRequestId(request.headers)
  const environment =
    process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown"
  const targetEnvironment = process.env.VERCEL_TARGET_ENV ?? environment
  const gitRevision = process.env.VERCEL_GIT_COMMIT_SHA

  return Response.json(
    {
      status: "ok",
      scope: "liveness",
      service: SERVICE,
      version: VERSION,
      revision:
        targetEnvironment === "staging"
          ? (gitRevision ?? VERSION)
          : (gitRevision?.slice(0, 12) ?? VERSION),
      environment,
      targetEnvironment,
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
