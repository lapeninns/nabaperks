import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { runInNewContext } from "node:vm"

const source = readFileSync(
  new URL("../../public/sw.js", import.meta.url),
  "utf8"
)

function loadWorker() {
  const listeners = {}
  const runtime = {
    URL,
    location: { origin: "https://nabaperks.com" },
    addEventListener(type, handler) {
      listeners[type] = handler
    },
    listeners,
  }
  runtime.self = runtime
  runInNewContext(source, runtime)
  return runtime
}

async function dispatchPush(raw) {
  const worker = loadWorker()
  const notifications = []
  worker.registration = {
    async showNotification(title, options) {
      notifications.push({ title, ...options })
    },
  }
  const waits = []
  worker.listeners.push({
    data:
      raw === null ? null : { json: () => JSON.parse(raw), text: () => raw },
    waitUntil(promise) {
      waits.push(promise)
    },
  })
  await Promise.all(waits)
  assert.equal(notifications.length, 1)
  return { worker, notification: notifications[0] }
}

test("malformed push JSON trims and caps the displayed fallback body at 180 characters", async () => {
  const raw = `  ${"Malformed push text ".repeat(30)}  `
  const { notification } = await dispatchPush(raw)

  assert.equal(notification.body, raw.trim().slice(0, 180))
  assert.equal(notification.body.length, 180)
  assert.equal(notification.title, "Nabaperks")
  assert.equal(notification.data.url, "/home")
})

for (const raw of ["", " \n\t ", null]) {
  test(`empty or missing push data uses the default body: ${JSON.stringify(raw)}`, async () => {
    const { notification } = await dispatchPush(raw)

    assert.equal(notification.body, "Your Nabaperks account has an update.")
    assert.equal(notification.data.url, "/home")
  })
}

test("a valid push retains its notification content and safe destination", async () => {
  const { notification } = await dispatchPush(
    JSON.stringify({
      title: "  Account update  ",
      body: "  Your account details are ready.  ",
      url: "/card/fixture?view=latest#details",
      notificationEventId: "fixture-event",
      eventType: "account_update",
    })
  )

  assert.equal(notification.title, "Account update")
  assert.equal(notification.body, "Your account details are ready.")
  assert.equal(notification.data.url, "/card/fixture?view=latest#details")
  assert.equal(notification.data.notificationEventId, "fixture-event")
  assert.equal(notification.data.eventType, "account_update")
})

test("a valid oversized body keeps the existing 180-character limit", async () => {
  const body = `  ${"Valid push text ".repeat(30)}  `
  const { notification } = await dispatchPush(JSON.stringify({ body }))

  assert.equal(notification.body, body.trim().slice(0, 180))
  assert.equal(notification.body.length, 180)
})

test("a foreign push destination displays and opens the safe default path", async () => {
  const { worker, notification } = await dispatchPush(
    JSON.stringify({
      body: "Account update",
      url: "https://evil.example/phish",
    })
  )
  assert.equal(notification.data.url, "/home")

  const opened = []
  worker.clients = {
    matchAll: async () => [],
    openWindow: async (url) => opened.push(url),
  }
  let closed = false
  const waits = []
  worker.listeners.notificationclick({
    notification: {
      data: notification.data,
      close() {
        closed = true
      },
    },
    waitUntil(promise) {
      waits.push(promise)
    },
  })
  await Promise.all(waits)

  assert.equal(closed, true)
  assert.deepEqual(opened, ["/home"])
})

test("the push worker does not intercept navigations or cache an app shell", () => {
  const worker = loadWorker()
  assert.equal(worker.listeners.fetch, undefined)
  assert.doesNotMatch(source, /nabaperks-pwa-v/)
  assert.doesNotMatch(source, /\/offline/)
  assert.deepEqual(Object.keys(worker.listeners).sort(), [
    "activate",
    "install",
    "notificationclick",
    "push",
    "pushsubscriptionchange",
  ])
})

test("activate deletes retired PWA caches and claims clients", async () => {
  const deleted = []
  let claimed = false
  const worker = loadWorker()
  worker.skipWaiting = async () => {}
  worker.clients = {
    claim: async () => {
      claimed = true
    },
  }
  worker.caches = {
    keys: async () => ["nabaperks-pwa-v4", "unrelated-cache"],
    delete: async (name) => {
      deleted.push(name)
      return true
    },
  }

  const waits = []
  worker.listeners.activate({
    waitUntil(promise) {
      waits.push(promise)
    },
  })
  await Promise.all(waits)

  assert.deepEqual(deleted, ["nabaperks-pwa-v4"])
  assert.equal(claimed, true)
})

test("notificationclick keeps same-origin paths and rejects a foreign origin", () => {
  const worker = loadWorker()
  const results = runInNewContext(
    `[safeNotificationUrl("/card/abc"), safeNotificationUrl("https://evil.example/phish"), safeNotificationUrl("https://nabaperks.com/home")]`,
    worker
  )
  const [sameOrigin, foreignOrigin, absoluteHome] = results
  assert.equal(sameOrigin, "/card/abc")
  assert.equal(foreignOrigin, "/home")
  assert.equal(absoluteHome, "/home")
})
