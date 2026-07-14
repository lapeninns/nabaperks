#!/usr/bin/env node
/**
 * capture-app-harness — drive the system Chrome headless to screenshot the
 * unauthenticated /dev/app-harness routes across the 8 responsive breakpoints.
 *
 * Dependency-free Node ESM (no Playwright/Puppeteer, no new npm deps) — a
 * sibling of the existing scripts/check-*.mjs guards. It shells out to the
 * installed Chrome with `--headless --screenshot --window-size=<w>,<h>` (the
 * same server-free approach the print-render workflow already uses), once per
 * route per width, writing `<route>-<width>.png` into the output dir.
 *
 * This is local verification convenience ONLY. It is deliberately OFF every CI
 * path (CI owns the required automated checks) and is never wired into a
 * package.json script. Run it by hand against a dev server.
 *
 * Prereq: a Next dev server serving the harness (these routes are dev-only:
 * `notFound()` in production). Default base is http://localhost:3100.
 *
 *   pnpm dev --port 3100            # in one terminal (or reuse :3000 dev)
 *   node scripts/capture-app-harness.mjs
 *   node scripts/capture-app-harness.mjs --base http://localhost:3000 --out ./shots
 *
 * Flags:
 *   --base <url>   base URL of the running dev server (default :3100)
 *   --out  <dir>   output directory (default ./screenshots)
 *   --height <px>  viewport height (default 2400, tall enough for long pages)
 *   --chrome <path> explicit Chrome/Chromium binary path
 */

import { execFile } from "node:child_process"
import { access, mkdir } from "node:fs/promises"
import { constants } from "node:fs"
import { join, resolve } from "node:path"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

// ─── Parameters (edit here) ─────────────────────────────────────────────────

/** The 8 responsive widths the /app UX review screenshots against. */
const WIDTHS = [320, 375, 390, 430, 768, 1024, 1280, 1440]

/**
 * Stable harness routes. `name` becomes the PNG filename stem; `path` is the
 * URL (with query) appended to the base. Keep these in sync with the
 * app/dev/app-harness/** pages and the qa-harness proofRoutes.
 */
const ROUTES = [
  { name: "dashboard", path: "/dev/app-harness/dashboard" },
  {
    name: "dashboard-sidebar-collapsed",
    path: "/dev/app-harness/dashboard?sidebar=collapsed",
  },
  { name: "customers", path: "/dev/app-harness/customers" },
  { name: "activity", path: "/dev/app-harness/activity" },
  { name: "account-profile", path: "/dev/app-harness/account?tab=profile" },
  { name: "account-billing", path: "/dev/app-harness/account?tab=billing" },
  { name: "launch-venue", path: "/dev/app-harness/launch?tab=venue" },
  { name: "launch-card", path: "/dev/app-harness/launch?tab=card" },
  { name: "launch-rewards", path: "/dev/app-harness/launch?tab=rewards" },
  { name: "launch-qr", path: "/dev/app-harness/launch?tab=qr" },
  { name: "onboarding", path: "/dev/app-harness/onboarding" },
  { name: "qr", path: "/dev/app-harness/qr" },
  { name: "scan", path: "/dev/app-harness/scan" },
  { name: "reward-scan", path: "/dev/app-harness/reward-scan" },
  {
    name: "reward-scan-collected",
    path: "/dev/app-harness/reward-scan?collected=1",
  },
  { name: "skeletons", path: "/dev/app-harness/skeletons" },
  { name: "states", path: "/dev/app-harness/states" },
]

/** Candidate Chrome/Chromium binaries, tried in order (macOS first). */
const CHROME_CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "google-chrome",
  "google-chrome-stable",
  "chromium",
  "chromium-browser",
]

// ─── CLI ────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = {
    base: "http://localhost:3100",
    out: "./screenshots",
    height: 2400,
    chrome: null,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i]
    if (flag === "--base") args.base = argv[++i]
    else if (flag === "--out") args.out = argv[++i]
    else if (flag === "--height") args.height = Number(argv[++i]) || args.height
    else if (flag === "--chrome") args.chrome = argv[++i]
  }
  args.base = args.base.replace(/\/$/, "")
  return args
}

async function isExecutable(path) {
  try {
    await access(path, constants.X_OK)
    return true
  } catch {
    return false
  }
}

async function resolveChrome(explicit) {
  if (explicit) {
    return explicit
  }
  for (const candidate of CHROME_CANDIDATES) {
    if (candidate.includes("/")) {
      if (await isExecutable(candidate)) return candidate
    } else {
      // Bare command name: trust PATH resolution at exec time.
      return candidate
    }
  }
  return null
}

async function captureOne({ chrome, url, outFile, width, height }) {
  // One throwaway profile + a few stability flags. --screenshot writes the PNG
  // and exits; --window-size pins the viewport width to the target breakpoint.
  const args = [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-sandbox",
    "--no-first-run",
    "--no-default-browser-check",
    "--force-device-scale-factor=1",
    `--window-size=${width},${height}`,
    `--screenshot=${outFile}`,
    url,
  ]
  await execFileAsync(chrome, args, { timeout: 60_000 })
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const outDir = resolve(process.cwd(), args.out)

  const chrome = await resolveChrome(args.chrome)
  if (!chrome) {
    console.error(
      "capture-app-harness: no Chrome/Chromium binary found. Pass --chrome <path>."
    )
    console.error("Tried:\n  " + CHROME_CANDIDATES.join("\n  "))
    process.exitCode = 1
    return
  }

  await mkdir(outDir, { recursive: true })

  console.log(`capture-app-harness`)
  console.log(`  chrome : ${chrome}`)
  console.log(`  base   : ${args.base}`)
  console.log(`  out    : ${outDir}`)
  console.log(`  widths : ${WIDTHS.join(", ")}`)
  console.log(
    `  routes : ${ROUTES.length}  →  ${ROUTES.length * WIDTHS.length} shots\n`
  )

  let ok = 0
  let failed = 0

  for (const route of ROUTES) {
    for (const width of WIDTHS) {
      const url = `${args.base}${route.path}`
      const outFile = join(outDir, `${route.name}-${width}.png`)
      try {
        await captureOne({
          chrome,
          url,
          outFile,
          width,
          height: args.height,
        })
        ok += 1
        console.log(`  ok    ${route.name}-${width}.png`)
      } catch (error) {
        failed += 1
        console.error(
          `  FAIL  ${route.name}-${width}.png — ${error?.message ?? error}`
        )
      }
    }
  }

  console.log(`\ndone: ${ok} captured, ${failed} failed → ${outDir}`)
  if (failed > 0) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
