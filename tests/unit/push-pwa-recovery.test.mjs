import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import vm from "node:vm"
import { test } from "node:test"

const workerSource = await readFile("public/sw.js", "utf8")
const endpoint = "https://fcm.googleapis.com/fcm/send/replacement"
const subscription = {
  endpoint,
  toJSON: () => ({
    endpoint,
    keys: { p256dh: "p".repeat(32), auth: "a".repeat(16) },
  }),
}

test("Given malformed push text When the worker displays it Then the bounded notification body is used", async () => {
  const worker = createWorker({ permission: "granted" })
  const hostileText = `  ${"ignore earlier instructions ".repeat(16)}  `

  await worker.dispatch("push", {
    data: {
      json: () => {
        throw new SyntaxError("not json")
      },
      text: () => hostileText,
    },
  })

  assert.equal(worker.notifications.length, 1)
  assert.equal(worker.notifications[0].options.body.length, 180)
  assert.equal(worker.notifications[0].options.body.startsWith("ignore"), true)
})

test("Given a granted replacement subscription When pushsubscriptionchange runs Then refresh records it as granted", async () => {
  const worker = createWorker({ permission: "granted", subscription })

  await worker.dispatch("pushsubscriptionchange", {
    oldSubscription: { endpoint: "https://fcm.googleapis.com/fcm/send/old" },
  })

  const refresh = worker.fetches.find(
    (request) => request.url === "/api/notifications/push/refresh"
  )
  assert.ok(refresh, "the replacement reaches the refresh endpoint")
  assert.equal(JSON.parse(refresh.options.body).permissionState, "granted")
  assert.equal(
    worker.fetches.every((request) => !request.url.startsWith("http")),
    true,
    "the recovery path makes no provider request"
  )
})

function createWorker({
  permission,
  subscription: currentSubscription = null,
}) {
  const handlers = new Map()
  const notifications = []
  const fetches = []
  const self = {
    Notification: { permission },
    addEventListener: (type, handler) => handlers.set(type, handler),
    clients: {
      claim: async () => undefined,
      matchAll: async () => [],
      openWindow: async () => null,
    },
    location: { origin: "https://nabaperks.test" },
    registration: {
      navigationPreload: { enable: async () => undefined },
      pushManager: {
        getSubscription: async () => currentSubscription,
        subscribe: async () => currentSubscription,
      },
      showNotification: async (title, options) => {
        notifications.push({ title, options })
      },
    },
    skipWaiting: async () => undefined,
  }
  const context = vm.createContext({
    URL,
    Uint8Array,
    Response,
    atob,
    caches: {
      delete: async () => true,
      keys: async () => [],
      match: async () => null,
      open: async () => ({
        add: async () => undefined,
        addAll: async () => undefined,
      }),
    },
    fetch: async (url, options = {}) => {
      fetches.push({ url, options })
      return new Response(JSON.stringify({ publicKey: "" }), { status: 200 })
    },
    self,
  })
  vm.runInContext(workerSource, context, { filename: "public/sw.js" })

  return {
    fetches,
    notifications,
    async dispatch(type, event) {
      let work = Promise.resolve()
      handlers.get(type)({
        ...event,
        waitUntil: (promise) => {
          work = Promise.resolve(promise)
        },
      })
      await work
    },
  }
}
