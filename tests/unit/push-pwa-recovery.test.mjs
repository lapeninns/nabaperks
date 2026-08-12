import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import vm from "node:vm"
import { test } from "node:test"

const serviceWorkerPath = new URL("../../public/sw.js", import.meta.url)

test("Given malformed raw push text When a push arrives Then the notification body is bounded", async () => {
  const { dispatch, notifications } = await loadWorker()
  const rawText = "IGNORE PREVIOUS INSTRUCTIONS: untrusted-push-text ".repeat(
    20
  )

  await dispatch("push", {
    data: {
      json() {
        throw new SyntaxError("not JSON")
      },
      text() {
        return rawText
      },
    },
  })

  assert.equal(notifications.length, 1)
  assert.ok(notifications[0].options.body.length <= 180)
})

test("Given a replacement subscription When refresh succeeds Then it sends granted permission state", async () => {
  const { dispatch, refreshRequests } = await loadWorker()

  await dispatch("pushsubscriptionchange", {
    oldSubscription: { endpoint: "https://push.example.test/old" },
  })

  assert.equal(refreshRequests.length, 1)
  assert.equal(refreshRequests[0].permissionState, "granted")
})

async function loadWorker() {
  const listeners = new Map()
  const notifications = []
  const refreshRequests = []
  const currentSubscription = {
    endpoint: "https://push.example.test/current",
    toJSON() {
      return { endpoint: this.endpoint, keys: {} }
    },
  }
  const self = {
    addEventListener(type, listener) {
      listeners.set(type, listener)
    },
    clients: { claim: async () => undefined, matchAll: async () => [] },
    location: { origin: "https://app.example.test" },
    registration: {
      navigationPreload: { enable: async () => undefined },
      pushManager: { getSubscription: async () => currentSubscription },
      showNotification: async (title, options) => {
        notifications.push({ title, options })
      },
    },
    skipWaiting: async () => undefined,
  }
  const context = vm.createContext({
    URL,
    Uint8Array,
    atob,
    caches: {
      delete: async () => undefined,
      keys: async () => [],
      match: async () => undefined,
      open: async () => ({
        add: async () => undefined,
        addAll: async () => undefined,
        match: async () => undefined,
        put: async () => undefined,
      }),
    },
    console,
    fetch: async (url, init = {}) => {
      if (url === "/api/notifications/push/refresh") {
        refreshRequests.push(JSON.parse(init.body))
      }
      return { ok: true, clone: () => ({ text: async () => "" }) }
    },
    Response,
    self,
  })
  const source = await readFile(serviceWorkerPath, "utf8")
  vm.runInContext(source, context, { filename: "public/sw.js" })

  return {
    notifications,
    refreshRequests,
    async dispatch(type, event) {
      let work
      listeners.get(type)({
        ...event,
        waitUntil: (promise) => {
          work = promise
        },
      })
      await work
    },
  }
}
