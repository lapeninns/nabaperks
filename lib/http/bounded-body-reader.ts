export const DEFAULT_REQUEST_BODY_TIMEOUT_MS = 10_000

export class RequestBodyTimeoutError extends Error {
  readonly name = "RequestBodyTimeoutError"
  readonly timeoutMs: number

  constructor(timeoutMs: number) {
    super("Request body read timed out")
    this.timeoutMs = timeoutMs
  }
}

export class RequestBodyTransportError extends Error {
  readonly name = "RequestBodyTransportError"

  constructor() {
    super("Request body transport failed")
  }
}

type BodySource = {
  readonly body: ReadableStream<Uint8Array> | null
}

export async function readBoundedBody(
  request: BodySource,
  maxBytes: number,
  timeoutMs = DEFAULT_REQUEST_BODY_TIMEOUT_MS
): Promise<Uint8Array | null> {
  if (!request.body) return new Uint8Array()

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let byteLength = 0
  let deadline: ReturnType<typeof setTimeout> | undefined

  const readBody = async (): Promise<Uint8Array | null> => {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      byteLength += value.byteLength
      if (byteLength > maxBytes) {
        await reader.cancel()
        return null
      }
      chunks.push(value)
    }

    const body = new Uint8Array(byteLength)
    let offset = 0
    for (const chunk of chunks) {
      body.set(chunk, offset)
      offset += chunk.byteLength
    }
    return body
  }

  const timeoutError = new RequestBodyTimeoutError(timeoutMs)
  const timeout = new Promise<never>((_, reject) => {
    deadline = setTimeout(() => reject(timeoutError), timeoutMs)
  })

  try {
    return await Promise.race([readBody(), timeout])
  } catch (error) {
    if (error instanceof RequestBodyTimeoutError) {
      void reader.cancel(error).catch(() => undefined)
      throw error
    }
    throw new RequestBodyTransportError()
  } finally {
    if (deadline !== undefined) clearTimeout(deadline)
    reader.releaseLock()
  }
}
