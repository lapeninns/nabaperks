import { execFile } from "node:child_process"
import { access, mkdir, rm, writeFile } from "node:fs/promises"
import { relative, resolve } from "node:path"
import { promisify } from "node:util"

import { Launcher, launch } from "chrome-launcher"
import lighthouse, { desktopConfig } from "lighthouse"

import {
  TASK20A_ASPIRATIONAL_LCP_MS,
  TASK20A_BLOCKING_LCP_MS,
  TASK20A_ROUTES,
  TASK20A_RUNS_PER_ROUTE,
} from "./task20a-lighthouse-policy.mjs"

export {
  assertCleanRevision,
  assertRevisionUnchanged,
  candidateIdentity,
  outputPath,
  runProductionBuild,
  startProductionServer,
  stopProcess,
} from "./task20a-lighthouse-processes.mjs"

const execFileAsync = promisify(execFile)

export async function startChrome(outputDirectory) {
  const executable = await realChromeExecutable()
  const { stdout } = await execFileAsync(executable, ["--version"])
  const version = stdout.trim()
  if (
    !/^Google Chrome \d+\./.test(version) ||
    /headless-shell/i.test(version)
  ) {
    throw new Error(
      "Task20A requires installed Google Chrome, not chrome-headless-shell"
    )
  }
  const profile = resolve(outputDirectory, "chrome-profile")
  await mkdir(profile, { recursive: false })
  const instance = await launch({
    chromeFlags: [
      "--headless=new",
      "--no-first-run",
      "--no-default-browser-check",
    ],
    chromePath: executable,
    handleSIGINT: false,
    logLevel: "error",
    userDataDir: profile,
  })
  return { ...instance, executable, profile, version }
}

export function isInstalledChromePath(path) {
  return /(?:Google Chrome|google-chrome(?:-stable)?)$/.test(path)
}

export async function collectReceipt(context) {
  const routes = []
  for (const route of TASK20A_ROUTES) {
    const routeDirectory = route === "/" ? "home" : route.slice(1)
    const rawReports = await collectRuns({
      chrome: context.chrome,
      origin: context.server.origin,
      outputDirectory: resolve(
        context.outputDirectory,
        "devtools",
        routeDirectory
      ),
      route,
      throttlingMethod: "provided",
    })
    const simulatedMobileRawReports = await collectRuns({
      chrome: context.chrome,
      origin: context.server.origin,
      outputDirectory: resolve(
        context.outputDirectory,
        "simulated-mobile",
        routeDirectory
      ),
      route,
      throttlingMethod: "simulate",
    })
    routes.push({
      route,
      rawReports: rawReports.map((path) =>
        relative(context.outputDirectory, path)
      ),
      simulatedMobileRawReports: simulatedMobileRawReports.map((path) =>
        relative(context.outputDirectory, path)
      ),
    })
  }
  return {
    schema: "nabaperks.task20a-lighthouse.v1",
    revision: context.revision,
    candidate: context.candidate,
    chrome: {
      devtoolsPort: context.chrome.port,
      executable: context.chrome.executable,
      profile: relative(context.outputDirectory, context.chrome.profile),
      version: context.chrome.version,
    },
    environmentFixture: "task20a-ci-non-secret",
    server: {
      origin: context.server.origin,
      port: context.server.port,
      revision: context.revision,
      runtime: "next start production build",
    },
    blocking: {
      aggregation: "median-of-exactly-three",
      lcpThresholdMs: TASK20A_BLOCKING_LCP_MS,
      measurement: "real-chrome-devtools",
      routes,
      runsPerRoute: TASK20A_RUNS_PER_ROUTE,
    },
    aspirationalGoodLine: {
      lcpThresholdMs: TASK20A_ASPIRATIONAL_LCP_MS,
      nonBlocking: true,
    },
    informationalTelemetry: {
      measurement: "simulated-mobile-lantern",
      runsPerRoute: TASK20A_RUNS_PER_ROUTE,
    },
  }
}

export async function stopChrome(chrome) {
  chrome.kill()
  await rm(chrome.profile, { force: true, recursive: true })
}

async function realChromeExecutable() {
  const candidates = Launcher.getInstallations().filter(isInstalledChromePath)
  const executable = candidates[0]
  if (!executable)
    throw new Error("Installed Google Chrome Stable was not found")
  await access(executable)
  return executable
}

async function collectRuns(options) {
  await mkdir(options.outputDirectory, { recursive: true })
  const reports = []
  for (let run = 1; run <= TASK20A_RUNS_PER_ROUTE; run += 1) {
    const config =
      options.throttlingMethod === "provided"
        ? {
            ...desktopConfig,
            settings: {
              ...desktopConfig.settings,
              onlyCategories: ["performance"],
              throttlingMethod: "provided",
            },
          }
        : {
            extends: "lighthouse:default",
            settings: {
              formFactor: "mobile",
              onlyCategories: ["performance"],
              throttlingMethod: "simulate",
            },
          }
    const result = await lighthouse(
      `${options.origin}${options.route}`,
      {
        logLevel: "silent",
        output: "json",
        port: options.chrome.port,
      },
      config
    )
    if (!result)
      throw new Error(`Lighthouse produced no result for ${options.route}`)
    const reportPath = resolve(options.outputDirectory, `run-${run}.json`)
    await writeJson(reportPath, result.lhr)
    reports.push(reportPath)
  }
  return reports
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`)
}
