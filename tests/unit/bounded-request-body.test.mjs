import assert from "node:assert/strict"
import { test } from "node:test"

import {
  parseJson,
  readBoundedRequestBody,
  RequestBodyTimeoutError,
  RequestBodyTransportError,
} from "@/lib/http/bounded-json-request"

function requestWithBody(stream) {
  return new Request("http://localhost/api/analytics/funnel", {
    method: "POST",
    body: stream,
    duplex: "half",
  })
}

test("a valid body remains readable within the byte limit", async () => {
  // Given
  const payload = '{"event":"menu_view"}'
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(payload))
      controller.close()
    },
  })

  // When
  const body = await readBoundedRequestBody(
    requestWithBody(stream),
    Buffer.byteLength(payload)
  )

  // Then
  assert.equal(body, payload)
})

test("a true oversize body still returns the oversize sentinel", async () => {
  // Given
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array([0x7b, 0x7d]))
      controller.close()
    },
  })

  // When
  const body = await readBoundedRequestBody(requestWithBody(stream), 1)

  // Then
  assert.equal(body, null)
})

test("a never-ending body is cancelled with a typed timeout error", async () => {
  // Given
  let sourceController
  let cancelledWith
  const stream = new ReadableStream({
    start(controller) {
      sourceController = controller
    },
    cancel(reason) {
      cancelledWith = reason
    },
  })
  const startedAt = performance.now()
  let watchdog

  // When / Then
  try {
    await assert.rejects(
      Promise.race([
        readBoundedRequestBody(requestWithBody(stream), 1_024, 20),
        new Promise((_, reject) => {
          watchdog = setTimeout(
            () => reject(new Error("reader exceeded the independent bound")),
            200
          )
        }),
      ]),
      RequestBodyTimeoutError
    )
    assert.ok(performance.now() - startedAt < 200)
    assert.ok(cancelledWith instanceof RequestBodyTimeoutError)
  } finally {
    clearTimeout(watchdog)
    sourceController.error(new Error("test cleanup"))
  }
})

test("a never-settling source cancellation cannot extend the body deadline", async () => {
  // Given
  let cancelReason
  const stream = new ReadableStream({
    cancel(reason) {
      cancelReason = reason
      return new Promise(() => {})
    },
  })
  let watchdog

  // When / Then
  try {
    await assert.rejects(
      Promise.race([
        readBoundedRequestBody(requestWithBody(stream), 1_024, 20),
        new Promise((_, reject) => {
          watchdog = setTimeout(
            () => reject(new Error("cancellation extended the body deadline")),
            200
          )
        }),
      ]),
      RequestBodyTimeoutError
    )
    assert.ok(cancelReason instanceof RequestBodyTimeoutError)
  } finally {
    clearTimeout(watchdog)
  }
})

test("a transport failure is distinct from the oversize sentinel", async () => {
  // Given
  const privateSentinel = "synthetic-private-body@example.test"
  const stream = new ReadableStream({
    start(controller) {
      controller.error(new Error(privateSentinel))
    },
  })

  // When / Then
  await assert.rejects(
    () => readBoundedRequestBody(requestWithBody(stream), 1_024),
    (error) =>
      error instanceof RequestBodyTransportError &&
      !error.message.includes(privateSentinel)
  )
})

test("malformed JSON remains a malformed-input result", () => {
  // Given / When / Then
  assert.equal(parseJson('{"event":'), null)
})

test("repeated timeout cancellation does not poison a fresh reader", async () => {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    // Given
    let sourceController
    const interruptedStream = new ReadableStream({
      start(controller) {
        sourceController = controller
      },
    })

    // When / Then
    try {
      await assert.rejects(
        () =>
          readBoundedRequestBody(requestWithBody(interruptedStream), 1_024, 10),
        RequestBodyTimeoutError
      )
    } finally {
      sourceController.error(new Error("test cleanup"))
    }

    const freshPayload = `{\"attempt\":${attempt}}`
    const freshStream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(freshPayload))
        controller.close()
      },
    })
    assert.equal(
      await readBoundedRequestBody(requestWithBody(freshStream), 1_024, 50),
      freshPayload
    )
  }
})

test("a completed reader deadline cannot poison the next slow read", async () => {
  // Given
  const immediateStream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array([0x7b, 0x7d]))
      controller.close()
    },
  })
  assert.equal(
    await readBoundedRequestBody(requestWithBody(immediateStream), 2, 20),
    "{}"
  )

  let sourceTimer
  const slowStream = new ReadableStream({
    start(controller) {
      sourceTimer = setTimeout(() => {
        controller.enqueue(new Uint8Array([0x7b, 0x7d]))
        controller.close()
      }, 35)
    },
    cancel() {
      clearTimeout(sourceTimer)
    },
  })

  // When / Then
  try {
    assert.equal(
      await readBoundedRequestBody(requestWithBody(slowStream), 2, 100),
      "{}"
    )
  } finally {
    clearTimeout(sourceTimer)
  }
})
