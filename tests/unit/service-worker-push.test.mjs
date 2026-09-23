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
