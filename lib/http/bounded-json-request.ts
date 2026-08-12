import type { NextRequest } from "next/server"

import {
  DEFAULT_REQUEST_BODY_TIMEOUT_MS,
  readBoundedBody,
} from "@/lib/http/bounded-body-reader"

export {
  RequestBodyTimeoutError,
  RequestBodyTransportError,
} from "@/lib/http/bounded-body-reader"

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
  maxBytes: number,
  timeoutMs = DEFAULT_REQUEST_BODY_TIMEOUT_MS
): Promise<string | null> {
  const body = await readBoundedBody(request, maxBytes, timeoutMs)
  if (body === null) return null

  const decoder = new TextDecoder("utf-8", { fatal: true })
  try {
    return decoder.decode(body)
  } catch {
    return null
  }
}

export function parseJson(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}
