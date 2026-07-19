import type { NextRequest } from "next/server"

export function isSameOriginRequest(request: NextRequest): boolean {
  const requestOrigin = request.headers.get("origin")
  if (!requestOrigin) return false

  const requestUrl = new URL(request.url)
  const allowedOrigins = new Set([requestUrl.origin])
  const forwardedHost = request.headers
    .get("x-forwarded-host")
    ?.split(",", 1)[0]
    ?.trim()
  const host = forwardedHost || request.headers.get("host")?.trim()
  const forwardedProtocol = request.headers
    .get("x-forwarded-proto")
    ?.split(",", 1)[0]
    ?.trim()
  const protocol = forwardedProtocol || requestUrl.protocol.replace(/:$/, "")

  if (host && /^(?:\[[0-9a-f:]+\]|[a-z0-9.-]+)(?::\d+)?$/i.test(host)) {
    try {
      allowedOrigins.add(new URL(`${protocol}://${host}`).origin)
    } catch {
      return false
    }
  }

  try {
    const parsedOrigin = new URL(requestOrigin)
    return (
      parsedOrigin.origin === requestOrigin && allowedOrigins.has(requestOrigin)
    )
  } catch {
    return false
  }
}

export function isJsonRequest(request: NextRequest): boolean {
  return (
    request.headers
      .get("content-type")
      ?.split(";", 1)[0]
      ?.trim()
      .toLowerCase() === "application/json"
  )
}

export async function readBoundedRequestBody(
  request: NextRequest,
  maxBytes: number
): Promise<string | null> {
  if (!request.body) return ""

  const reader = request.body.getReader()
  const decoder = new TextDecoder("utf-8", { fatal: true })
  const decoded: string[] = []
  let bytesRead = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      bytesRead += value.byteLength
      if (bytesRead > maxBytes) {
        await reader.cancel()
        return null
      }

      decoded.push(decoder.decode(value, { stream: true }))
    }

    decoded.push(decoder.decode())
    return decoded.join("")
  } catch {
    return null
  } finally {
    reader.releaseLock()
  }
}

export function parseJson(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}
