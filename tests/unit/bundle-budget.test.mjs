import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { test } from "node:test"

const checker = resolve("scripts/check-bundle-size.mjs")
const wrapper = (route, body) =>
  `globalThis.__RSC_MANIFEST=(globalThis.__RSC_MANIFEST||{});globalThis.__RSC_MANIFEST[${JSON.stringify(route)}]=${JSON.stringify(typeof body.clientModules === "object" && body.clientModules !== null && !Array.isArray(body.clientModules) ? { ...body, clientModules: { ...body.clientModules, "fixture-shared": { chunks: ["1", "static/chunks/shared.js"] } } } : body)};`

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "nabaperks-bundle-budget-"))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const write = (name, content) => {
    const file = join(root, name)
    mkdirSync(join(file, ".."), { recursive: true })
    writeFileSync(
      file,
      typeof content === "string" ? content : JSON.stringify(content)
    )
  }
  write("config/bundle-budget.json", {
    maxRootFirstLoadJsBytes: 350,
    maxRouteFirstLoadJsBytes: 350,
    maxSingleChunkBytes: 200,
  })
  write(".next/build-manifest.json", {
    polyfillFiles: [],
    rootMainFiles: ["static/chunks/shared.js"],
  })
  write(".next/BUILD_ID", "fixture-build")
  write(".next/app-entry-manifest.json", {
    ssrReferences: {
      "app/page": ["fixture-shared"],
      "app/account/[id]/page": ["fixture-shared"],
    },
    initialModules: {},

    version: 3,
    buildId: "fixture-build",
    entries: {
      "app/page": ["static/chunks/shared.js", "static/chunks/home.js"],
      "app/account/[id]/page": ["static/chunks/app/account/%5Bid%5D/page.js"],
    },
  })
  write(".next/server/app-paths-manifest.json", {
    "/page": "app/page.js",
    "/account/[id]/page": "app/account/[id]/page.js",
    "/api/health/route": "app/api/health/route.js",
  })
  write(".next/static/chunks/shared.js", "x".repeat(100))
  write(".next/static/chunks/home.js", "x".repeat(100))
  write(".next/static/chunks/app/account/[id]/page.js", "x".repeat(120))
  write(
    ".next/server/app/page_client-reference-manifest.js",
    wrapper("/page", {
      moduleLoading: { prefix: "/_next/" },
      clientModules: {
        home: {
          id: 10,
          chunks: [
            "1",
            "static/chunks/shared.js",
            "2",
            "static/chunks/home.js",
          ],
        },
      },
    })
  )
  write(
    ".next/server/app/account/[id]/page_client-reference-manifest.js",
    wrapper("/account/[id]/page", {
      moduleLoading: { prefix: "/_next/" },
      clientModules: {
        account: {
          id: 20,
          chunks: [
            "1",
            "static/chunks/shared.js",
            "3",
            "static/chunks/app/account/%5Bid%5D/page.js",
          ],
        },
      },
    })
  )
  const run = () =>
    spawnSync(process.execPath, [checker], { cwd: root, encoding: "utf8" })
  return { root, write, run }
}

test("webpack page budgets include shared chunks once and decode bracket paths", (t) => {
  const { run } = fixture(t)
  const result = run()
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /2 app entries checked/)
  assert.match(result.stdout, /root first-load JS 200 bytes/)
})

test("route budget refuses an oversized recognised webpack page", (t) => {
  const { write, run } = fixture(t)
  write("config/bundle-budget.json", {
    maxRootFirstLoadJsBytes: 350,
    maxRouteFirstLoadJsBytes: 210,
    maxSingleChunkBytes: 200,
  })
  const result = run()
  assert.equal(result.status, 1)
  assert.match(result.stderr, /account.*220 bytes.*210/)
})

test("root budget includes the homepage inside a route group", (t) => {
  // Given a grouped homepage whose shared and page chunks exceed root budget.
  const { write, run } = fixture(t)
  write(".next/server/app-paths-manifest.json", {
    "/(marketing)/page": "app/(marketing)/page.js",
  })
  write(".next/app-entry-manifest.json", {
    ssrReferences: { "app/(marketing)/page": ["fixture-shared"] },
    initialModules: {},

    version: 3,
    buildId: "fixture-build",
    entries: { "app/(marketing)/page": ["static/chunks/home.js"] },
  })
  write(
    ".next/server/app/(marketing)/page_client-reference-manifest.js",
    wrapper("/(marketing)/page", {
      clientModules: { home: { chunks: ["2", "static/chunks/home.js"] } },
    })
  )
  write("config/bundle-budget.json", {
    maxRootFirstLoadJsBytes: 199,
    maxRouteFirstLoadJsBytes: 350,
    maxSingleChunkBytes: 200,
  })
  // When the real CLI checks the grouped build.
  const result = run()
  // Then the root budget cannot silently omit the homepage chunks.
  assert.equal(result.status, 1)
  assert.match(result.stderr, /Root first-load JS.*200 bytes/)
})

test("bundle checker refuses a route map without a homepage", (t) => {
  // Given an otherwise supported build with no root page entry.
  const { write, run } = fixture(t)
  write(".next/server/app-paths-manifest.json", {
    "/account/[id]/page": "app/account/[id]/page.js",
  })
  // When the real CLI checks the incomplete route evidence.
  const result = run()
  // Then it refuses rather than measuring only shared root files.
  assert.equal(result.status, 1)
  assert.match(result.stderr, /homepage/i)
})

test("initial route budget includes its ancestor layout and fallback chunks", (t) => {
  const { write, run } = fixture(t)
  write(".next/static/chunks/account-layout.js", "x".repeat(140))
  write(".next/app-entry-manifest.json", {
    ssrReferences: {
      "app/page": ["fixture-shared"],
      "app/account/layout": ["fixture-shared"],
      "app/account/[id]/page": ["fixture-shared"],
    },
    initialModules: {},

    version: 3,
    buildId: "fixture-build",
    entries: {
      "app/page": ["static/chunks/home.js"],
      "app/account/layout": ["static/chunks/account-layout.js"],
      "app/account/[id]/page": ["static/chunks/app/account/%5Bid%5D/page.js"],
    },
  })
  const result = run()
  assert.equal(result.status, 1)
  assert.match(result.stderr, /account.*360 bytes.*350/)
})

test("sibling references are validated without billing them to an unrelated initial entry", (t) => {
  const { write, run } = fixture(t)
  write(".next/static/chunks/sibling.js", "x".repeat(180))
  write(
    ".next/server/app/account/[id]/page_client-reference-manifest.js",
    wrapper("/account/[id]/page", {
      clientModules: { sibling: { chunks: ["4", "static/chunks/sibling.js"] } },
    })
  )
  const result = run()
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /largest route 220 bytes/)
})

for (const [name, manifest] of [
  ["stale build identity", { version: 3, buildId: "other-build", entries: {} }],
  [
    "unknown compiler format",
    { version: 99, buildId: "fixture-build", entries: {} },
  ],
  [
    "missing page entry",
    {
      version: 3,
      buildId: "fixture-build",
      entries: {},
      initialModules: {},
      ssrReferences: { "app/page": ["home"] },
    },
  ],
]) {
  test(`bundle checker refuses ${name}`, (t) => {
    const { write, run } = fixture(t)
    write(".next/app-entry-manifest.json", manifest)
    const result = run()
    assert.equal(result.status, 1)
    assert.match(result.stderr, /stale|Unsupported|Missing initial/)
  })
}

test("bundle checker refuses missing initial compiler evidence", (t) => {
  const { root, run } = fixture(t)
  rmSync(join(root, ".next/app-entry-manifest.json"))
  const result = run()
  assert.equal(result.status, 1)
  assert.match(result.stderr, /app-entry-manifest/)
})

for (const [name, path, content, diagnostic] of [
  [
    "empty route map",
    ".next/server/app-paths-manifest.json",
    {},
    /No.*page.*routes/i,
  ],
  [
    "malformed route map",
    ".next/server/app-paths-manifest.json",
    "{",
    /app-paths-manifest/,
  ],
  [
    "unsupported client format",
    ".next/server/app/page_client-reference-manifest.js",
    "globalThis.data = {};",
    /manifest/i,
  ],
  [
    "empty client file",
    ".next/server/app/page_client-reference-manifest.js",
    "",
    /manifest/i,
  ],
  [
    "malformed manifest JSON",
    ".next/server/app/page_client-reference-manifest.js",
    'globalThis.__RSC_MANIFEST=(globalThis.__RSC_MANIFEST||{});globalThis.__RSC_MANIFEST["/page"]={;',
    /manifest/i,
  ],
  [
    "wrong route binding",
    ".next/server/app/page_client-reference-manifest.js",
    wrapper("/other/page", { clientModules: {} }),
    /route|manifest/i,
  ],
  [
    "missing client modules",
    ".next/server/app/page_client-reference-manifest.js",
    wrapper("/page", {}),
    /clientModules/,
  ],
  [
    "odd chunk pair list",
    ".next/server/app/page_client-reference-manifest.js",
    wrapper("/page", { clientModules: { x: { chunks: ["1"] } } }),
    /chunks/,
  ],
  [
    "missing chunk",
    ".next/server/app/page_client-reference-manifest.js",
    wrapper("/page", {
      clientModules: { x: { chunks: ["1", "static/chunks/missing.js"] } },
    }),
    /missing.js/,
  ],
  [
    "path traversal",
    ".next/server/app/page_client-reference-manifest.js",
    wrapper("/page", {
      clientModules: {
        x: { chunks: ["1", "static/chunks/../../../outside.js"] },
      },
    }),
    /path|chunk/i,
  ],
  [
    "empty shared manifest",
    ".next/build-manifest.json",
    { polyfillFiles: [], rootMainFiles: [] },
    /rootMainFiles/,
  ],
  [
    "invalid budget",
    "config/bundle-budget.json",
    { maxRouteFirstLoadJsBytes: -1 },
    /budget/i,
  ],
]) {
  test(`bundle checker refuses ${name}`, (t) => {
    const { write, run } = fixture(t)
    write(path, content)
    const result = run()
    assert.equal(result.status, 1, result.stdout)
    assert.match(result.stderr, diagnostic)
  })
}

test("bundle checker refuses a missing page manifest", (t) => {
  const { root, run } = fixture(t)
  rmSync(join(root, ".next/server/app/page_client-reference-manifest.js"))
  const result = run()
  assert.equal(result.status, 1)
  assert.match(result.stderr, /page_client-reference-manifest/)
})

test("bundle checker still enforces single chunk and root budgets", (t) => {
  const { write, run } = fixture(t)
  write(".next/static/chunks/lazy.js", "x".repeat(201))
  assert.match(run().stderr, /lazy.js.*201 bytes/)
  write("config/bundle-budget.json", {
    maxRootFirstLoadJsBytes: 199,
    maxRouteFirstLoadJsBytes: 350,
    maxSingleChunkBytes: 200,
  })
  assert.match(run().stderr, /Root first-load JS.*200 bytes/)
})

test("nomodule fallback is validated separately from supported-browser first load", (t) => {
  const { write, run } = fixture(t)
  write(".next/build-manifest.json", {
    polyfillFiles: ["static/chunks/polyfills.js"],
    rootMainFiles: ["static/chunks/shared.js"],
  })
  write(".next/static/chunks/polyfills.js", "x".repeat(200))
  const result = run()
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /root first-load JS 200 bytes/)
  assert.match(result.stdout, /nomodule fallback 200 bytes/)
  write(".next/static/chunks/polyfills.js", "x".repeat(201))
  assert.match(run().stderr, /polyfills.js.*201 bytes/)
  write(".next/build-manifest.json", {
    polyfillFiles: ["static/chunks/missing-polyfills.js"],
    rootMainFiles: ["static/chunks/shared.js"],
  })
  assert.match(run().stderr, /Missing JavaScript chunk.*missing-polyfills/)
})

function scannerFixture(t) {
  const result = fixture(t)
  const { write } = result
  write(".next/server/app-paths-manifest.json", {
    "/page": "app/page.js",
    "/scan/page": "app/scan/page.js",
  })
  write(".next/app-entry-manifest.json", {
    ssrReferences: {
      "app/page": ["fixture-shared"],
      "app/scan/page": ["fixture-shared"],
    },
    initialModules: {},

    version: 3,
    buildId: "fixture-build",
    entries: {
      "app/page": ["static/chunks/home.js"],
      "app/scan/page": ["static/chunks/scan.js"],
    },
  })
  write(".next/static/chunks/scan.js", "x".repeat(150))
  write(".next/static/chunks/decoder.js", "x".repeat(160))
  write(
    ".next/server/app/scan/page_client-reference-manifest.js",
    wrapper("/scan/page", { clientModules: {} })
  )
  write(".next/react-loadable-manifest.json", {
    "components/customer/customer-qr-scanner-loader.tsx -> ./customer-qr-scanner":
      {
        id: 42,
        files: ["static/chunks/decoder.js"],
      },
  })
  return result
}

test("camera's immediate dynamic decoder is charged to initial route bytes", (t) => {
  const { run } = scannerFixture(t)
  const result = run()
  assert.equal(result.status, 1)
  assert.match(result.stderr, /scan\/page.*410 bytes/)
})

test("camera refuses missing or CSS-only immediate dynamic output", (t) => {
  const { write, run } = scannerFixture(t)
  write(".next/react-loadable-manifest.json", {})
  assert.match(run().stderr, /Missing immediate dynamic loader output/)
  write(".next/react-loadable-manifest.json", {
    "components/customer/customer-qr-scanner-loader.tsx -> ./customer-qr-scanner":
      {
        id: 42,
        files: ["static/chunks/decoder.css"],
      },
  })
  assert.match(run().stderr, /Missing immediate dynamic JavaScript/)
})

test("eager scanner is accepted only when the same-build initial module graph proves it", (t) => {
  const { write, run } = scannerFixture(t)
  const entries = {
    "app/page": ["static/chunks/home.js"],
    "app/scan/page": ["static/chunks/scan.js"],
  }
  write(".next/app-entry-manifest.json", {
    ssrReferences: Object.fromEntries(
      Object.keys(entries).map((entry) => [entry, ["fixture-shared"]])
    ),

    version: 3,
    buildId: "fixture-build",
    entries,
    initialModules: {
      "app/page": [],
      "app/scan/page": ["components/customer/customer-qr-scanner.tsx"],
    },
  })
  write(".next/react-loadable-manifest.json", {
    "components/customer/customer-qr-scanner-loader.tsx -> ./customer-qr-scanner":
      { id: 42, files: [] },
  })
  assert.equal(run().status, 0)
  write(".next/app-entry-manifest.json", {
    ssrReferences: Object.fromEntries(
      Object.keys(entries).map((entry) => [entry, ["fixture-shared"]])
    ),

    version: 3,
    buildId: "fixture-build",
    entries,
    initialModules: { "app/page": [], "app/scan/page": [] },
  })
  assert.match(run().stderr, /Missing immediate dynamic loader output/)
})

test("SSR-selected references charge parser preloads from a sibling chunk mapping", (t) => {
  const { write, run } = fixture(t)
  write(".next/app-entry-manifest.json", {
    version: 3,
    buildId: "fixture-build",
    initialModules: {},
    entries: {
      "app/page": ["static/chunks/home.js"],
      "app/account/[id]/page": ["static/chunks/app/account/%5Bid%5D/page.js"],
    },
    ssrReferences: {
      "app/page": ["home"],
      "app/account/[id]/page": ["server-link"],
    },
  })
  write(".next/static/chunks/ssr-selected.js", "x".repeat(160))
  write(
    ".next/server/app/account/[id]/page_client-reference-manifest.js",
    wrapper("/account/[id]/page", {
      clientModules: {
        "server-link": { chunks: ["4", "static/chunks/ssr-selected.js"] },
      },
    })
  )
  const result = run()
  assert.equal(result.status, 1)
  assert.match(result.stderr, /account.*380 bytes, budget is 350/)
})

test("SSR graph absence or missing selected module fails closed", (t) => {
  const { write, run } = fixture(t)
  const manifest = {
    version: 3,
    buildId: "fixture-build",
    initialModules: {},
    entries: {
      "app/page": ["static/chunks/home.js"],
      "app/account/[id]/page": ["static/chunks/app/account/%5Bid%5D/page.js"],
    },
  }
  write(".next/app-entry-manifest.json", manifest)
  assert.match(run().stderr, /Missing SSR client reference graph/)
  write(".next/app-entry-manifest.json", {
    ...manifest,
    ssrReferences: { "app/page": [], "app/account/[id]/page": [] },
  })
  assert.match(run().stderr, /Missing SSR client reference graph/)
  write(".next/app-entry-manifest.json", {
    ...manifest,
    ssrReferences: { "app/page": ["absent"] },
  })
  assert.match(run().stderr, /Missing emitted SSR client reference/)
})

test("not-found fallback chunks remain part of first-load route budgets", (t) => {
  const { write, run } = fixture(t)
  write("config/bundle-budget.json", {
    maxRootFirstLoadJsBytes: 1000,
    maxRouteFirstLoadJsBytes: 350,
    maxSingleChunkBytes: 200,
  })
  write(".next/app-entry-manifest.json", {
    ssrReferences: {
      "app/page": ["fixture-shared"],
      "app/account/[id]/page": ["fixture-shared"],
      "app/not-found": ["fixture-shared"],
    },
    initialModules: {},

    version: 3,
    buildId: "fixture-build",
    entries: {
      "app/page": ["static/chunks/home.js"],
      "app/account/[id]/page": ["static/chunks/app/account/%5Bid%5D/page.js"],
      "app/not-found": ["static/chunks/not-found.js"],
    },
  })
  write(".next/static/chunks/not-found.js", "x".repeat(180))
  const result = run()
  assert.equal(result.status, 1)
  assert.match(result.stderr, /account.*400 bytes, budget is 350/)
})

for (const version of [1, 2]) {
  test(`compiler metadata v${version} is refused because it cannot prove SSR preloads`, (t) => {
    const { write, run } = fixture(t)
    write(".next/app-entry-manifest.json", {
      version,
      buildId: "fixture-build",
      entries: { "app/page": ["static/chunks/home.js"] },
    })
    const result = run()
    assert.equal(result.status, 1)
    assert.match(result.stderr, /Unsupported or stale app-entry-manifest/)
  })
}
