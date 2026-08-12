import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import path from "node:path"
import { fileURLToPath } from "node:url"
import typescript from "typescript"

const testDirectory = path.dirname(fileURLToPath(import.meta.url))
const repositoryRoot = path.resolve(testDirectory, "../..")
const componentPath = path.join(
  repositoryRoot,
  "components/customer/push-notification-settings.tsx"
)
const helperPath = path.join(
  repositoryRoot,
  "components/customer/push-notification-settings-state.ts"
)
const baselineRevision = process.env.PUSH_SETTINGS_REVISION

test("Given an earlier preference save rejects after a later save When the settings render Then the later choice remains visible", async () => {
  const runtime = await loadSettingsRuntime()
  try {
    const initial = runtime.render()
    const firstPreference = findCheckbox(initial, "Venue offers")
    const firstRequest = deferred()

    runtime.fetch = () => firstRequest.promise
    firstPreference.onChange({ currentTarget: { checked: true } })

    const secondPreference = findCheckbox(runtime.render(), "Reminders")
    runtime.fetch = async (_url, init) => successfulPreferenceResponse(init)
    secondPreference.onChange({ currentTarget: { checked: false } })
    await flushMicrotasks()

    firstRequest.resolve({ ok: false })
    await flushMicrotasks()

    assert.equal(runtime.preferences().reminderEnabled, false)
  } finally {
    runtime.cleanup()
  }
})

test("Given service worker readiness never settles When settings initialises Then the status becomes recoverable", async () => {
  const runtime = await loadSettingsRuntime({ neverReady: true })
  try {
    runtime.render()
    await runtime.runEffects()
    await runtime.waitForTimeout()

    assert.match(textContent(runtime.render()), /Push needs attention/)
  } finally {
    runtime.cleanup()
  }
})

async function loadSettingsRuntime(options = {}) {
  const source = baselineRevision
    ? execFileSync(
        "git",
        [
          "show",
          `${baselineRevision}:components/customer/push-notification-settings.tsx`,
        ],
        { cwd: repositoryRoot, encoding: "utf8" }
      )
    : readFileSync(componentPath, "utf8")
  const effects = []
  const values = []
  const refs = []
  let cursor = 0
  let fetchImplementation = async () => ({ ok: false })
  const nativeSetTimeout = globalThis.setTimeout
  const originalGlobals = captureGlobals([
    "Notification",
    "document",
    "fetch",
    "navigator",
    "setTimeout",
    "window",
  ])

  const react = {
    useEffect(effect) {
      effects.push(effect)
    },
    useMemo(factory) {
      return factory()
    },
    useRef(initialValue) {
      const index = cursor
      cursor += 1
      refs[index] ??= { current: initialValue }
      return refs[index]
    },
    useState(initialValue) {
      const index = cursor
      cursor += 1
      values[index] ??= initialValue
      return [
        values[index],
        (nextValue) => {
          values[index] =
            typeof nextValue === "function"
              ? nextValue(values[index])
              : nextValue
        },
      ]
    },
  }
  const jsx = (type, props) => ({ type, props: props ?? {} })
  const moduleExports = {}
  const require = (specifier) => {
    if (specifier === "react") return react
    if (specifier === "react/jsx-runtime") return { jsx, jsxs: jsx }
    if (specifier === "@hugeicons/core-free-icons") return {}
    if (specifier === "@/components/brand") return {}
    if (specifier === "@/components/ui/button") return { Button: () => null }
    if (specifier === "@/lib/utils")
      return { cn: (...names) => names.join(" ") }
    if (specifier === "./push-notification-settings-state") {
      return loadHelperModule(react)
    }
    throw new Error(`Unexpected module: ${specifier}`)
  }
  const compiled = typescript.transpileModule(source, {
    compilerOptions: {
      jsx: typescript.JsxEmit.ReactJSX,
      module: typescript.ModuleKind.CommonJS,
      target: typescript.ScriptTarget.ES2022,
    },
  }).outputText
  const execute = new Function("exports", "require", compiled)
  execute(moduleExports, require)

  Object.defineProperty(globalThis, "Notification", {
    configurable: true,
    value: {
      permission: "granted",
      requestPermission: async () => "granted",
    },
  })
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      serviceWorker: {
        ready: options.neverReady
          ? new Promise(() => {})
          : Promise.resolve({
              pushManager: { getSubscription: async () => null },
            }),
      },
      userAgent: "test",
    },
  })
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      Notification: globalThis.Notification,
      PushManager: function PushManager() {},
      addEventListener() {},
      atob: (value) => Buffer.from(value, "base64").toString("binary"),
      matchMedia: () => ({ matches: false }),
      removeEventListener() {},
    },
  })
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { addEventListener() {}, removeEventListener() {} },
  })
  globalThis.setTimeout = (callback) => nativeSetTimeout(callback, 5)
  globalThis.fetch = (...args) => fetchImplementation(...args)

  return {
    fetch: fetchImplementation,
    preferences() {
      return values[1]
    },
    cleanup() {
      restoreGlobals(originalGlobals)
    },
    render() {
      cursor = 0
      return moduleExports.PushNotificationSettings({ showHeader: false })
    },
    async runEffects() {
      for (const effect of effects.splice(0)) effect()
      await flushMicrotasks()
    },
    async waitForTimeout() {
      await new Promise((resolve) => nativeSetTimeout(resolve, 15))
    },
    set fetch(nextFetch) {
      fetchImplementation = nextFetch
    },
  }
}

function loadHelperModule() {
  const helperExports = {}
  const helperSource = readFileSync(helperPath, "utf8")
  const compiled = typescript.transpileModule(helperSource, {
    compilerOptions: {
      module: typescript.ModuleKind.CommonJS,
      target: typescript.ScriptTarget.ES2022,
    },
  }).outputText
  new Function("exports", compiled)(helperExports)
  return helperExports
}

function findCheckbox(element, label) {
  if (element?.type === "label" && textContent(element).includes(label)) {
    return findInputs(element)[0]
  }
  for (const child of childrenOf(element)) {
    const match = findCheckbox(child, label)
    if (match) return match
  }
  return null
}

function findInputs(element) {
  const direct = element?.type === "input" ? [element.props] : []
  return direct.concat(childrenOf(element).flatMap(findInputs))
}

function childrenOf(element) {
  const children = element?.props?.children
  if (!children) return []
  return Array.isArray(children) ? children : [children]
}

function textContent(element) {
  if (typeof element === "string") return element
  return childrenOf(element).map(textContent).join(" ")
}

function deferred() {
  let resolve
  const promise = new Promise((nextResolve) => {
    resolve = nextResolve
  })
  return { promise, resolve }
}

async function successfulPreferenceResponse(init) {
  return {
    json: async () => ({ preferences: JSON.parse(init.body) }),
    ok: true,
  }
}

async function flushMicrotasks() {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

function captureGlobals(names) {
  return new Map(
    names.map((name) => [
      name,
      Object.getOwnPropertyDescriptor(globalThis, name),
    ])
  )
}

function restoreGlobals(globals) {
  for (const [name, descriptor] of globals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor)
    else delete globalThis[name]
  }
}
