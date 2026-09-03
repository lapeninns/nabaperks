import type { NextRequest } from "next/server"

function canonicalHttpOrigin(value: string | undefined): string | null {
  const candidate = value?.trim()
  if (!candidate) return null
  try {
    const parsed = new URL(candidate)
    if (
      (parsed.protocol !== "https:" && parsed.protocol !== "http:") ||
      parsed.origin !== candidate
    ) {
      return null
    }
    return parsed.origin
  } catch {
    return null
  }
}

function isLoopbackHostname(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "[::1]" ||
    /^127(?:\.\d{1,3}){3}$/.test(hostname)
  )
}

export function isSameOriginRequest(
  request: NextRequest,
  configuredAppUrl: string | undefined
): boolean {
  const requestOrigin = request.headers.get("origin")
  if (!requestOrigin) return false

  const configuredOrigin = canonicalHttpOrigin(configuredAppUrl)
  if (!configuredOrigin) return false

  try {
    const parsedOrigin = new URL(requestOrigin)
    if (parsedOrigin.origin !== requestOrigin) return false
    if (requestOrigin === configuredOrigin) return true

    // next dev is sometimes reached through another loopback address or port.
    // Keep that compatibility local-only; deployed requests must match the
    // configured canonical application origin exactly.
    const configuredUrl = new URL(configuredOrigin)
    const requestUrl = new URL(request.url)
    return (
      isLoopbackHostname(configuredUrl.hostname) &&
      isLoopbackHostname(requestUrl.hostname) &&
      parsedOrigin.origin === requestUrl.origin
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
  const result = await readBoundedRequestBodyResult(request, maxBytes)
  return result.status === "ok" ? result.value : null
}

type BoundedRequestBodyResult =
  | { readonly status: "ok"; readonly value: string }
  | { readonly status: "invalid" }
  | { readonly status: "overflow" }

async function readBoundedRequestBodyResult(
  request: NextRequest,
  maxBytes: number
): Promise<BoundedRequestBodyResult> {
  if (!request.body) return { status: "ok", value: "" }

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
        return { status: "overflow" }
      }

      decoded.push(decoder.decode(value, { stream: true }))
    }

    decoded.push(decoder.decode())
    return { status: "ok", value: decoded.join("") }
  } catch {
    return { status: "invalid" }
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

export type BoundedJsonRequestResult =
  | { readonly ok: true; readonly value: unknown }
  | {
      readonly ok: false
      readonly status: 400 | 413 | 415
      readonly error:
        | "invalid_content_length"
        | "invalid_json"
        | "payload_too_large"
        | "unsupported_media_type"
    }

export async function readBoundedJsonRequest(
  request: NextRequest,
  maxBytes: number
): Promise<BoundedJsonRequestResult> {
  if (!isJsonRequest(request)) {
    return { ok: false, status: 415, error: "unsupported_media_type" }
  }

  const declaredLength = request.headers.get("content-length")
  if (declaredLength !== null) {
    if (!/^\d+$/.test(declaredLength)) {
      return { ok: false, status: 400, error: "invalid_content_length" }
    }
    if (Number(declaredLength) > maxBytes) {
      return { ok: false, status: 413, error: "payload_too_large" }
    }
  }

  const body = await readBoundedRequestBodyResult(request, maxBytes)
  if (body.status === "overflow") {
    return { ok: false, status: 413, error: "payload_too_large" }
  }
  if (body.status === "invalid") {
    return { ok: false, status: 400, error: "invalid_json" }
  }

  try {
    return { ok: true, value: JSON.parse(body.value) }
  } catch {
    return { ok: false, status: 400, error: "invalid_json" }
  }
}
