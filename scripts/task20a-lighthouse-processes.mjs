import { execFile, spawn } from "node:child_process"
import { lstat, realpath, writeFile } from "node:fs/promises"
import { createServer } from "node:net"
import { relative, resolve, sep } from "node:path"
import { promisify } from "node:util"

import { TASK20A_AUDIT_ENV } from "./task20a-lighthouse-fixtures.mjs"

const execFileAsync = promisify(execFile)
const SERVER_TIMEOUT_MS = 60_000

export async function assertCleanRevision() {
  const { stdout } = await execFileAsync("git", [
    "status",
    "--porcelain",
    "--untracked-files=no",
  ])
  if (stdout.trim())
    throw new Error("Task20A requires a clean tracked worktree")
  const { stdout: revision } = await execFileAsync("git", ["rev-parse", "HEAD"])
  return revision.trim()
}

export async function candidateIdentity() {
  const revision = await assertCleanRevision()
  const [{ stdout: parent }, { stdout: tree }] = await Promise.all([
    execFileAsync("git", ["rev-parse", "HEAD^"]),
    execFileAsync("git", ["rev-parse", "HEAD^{tree}"]),
  ])
  return { clean: true, parent: parent.trim(), revision, tree: tree.trim() }
}

export async function assertRevisionUnchanged(expectedRevision) {
  const currentRevision = await assertCleanRevision()
  if (currentRevision !== expectedRevision) {
    throw new Error(
      "Task20A source revision changed during the production build"
    )
  }
}

export async function outputPath(projectRoot, configuredPath, revision) {
  const candidate = configuredPath ?? `reports/task20a-lighthouse/${revision}`
  const resolvedProjectRoot = await realpath(projectRoot)
  const resolved = resolve(resolvedProjectRoot, candidate)
  const pathFromProject = relative(resolvedProjectRoot, resolved)
  if (
    !pathFromProject ||
    pathFromProject === ".." ||
    pathFromProject.startsWith(`..${sep}`)
  ) {
    throw new Error(
      "Task20A output directory must remain inside the repository"
    )
  }
  await assertNoSymlinkComponents(resolvedProjectRoot, pathFromProject)
  return resolved
}

async function assertNoSymlinkComponents(projectRoot, relativePath) {
  let currentPath = projectRoot
  for (const component of relativePath.split(sep)) {
    currentPath = resolve(currentPath, component)
    try {
      const status = await lstat(currentPath)
      if (status.isSymbolicLink())
        throw new Error("Task20A output path cannot contain a symlink")
    } catch (error) {
      if (error && typeof error === "object" && error.code === "ENOENT") return
      throw error
    }
  }
}

export async function runProductionBuild(projectRoot, outputDirectory) {
  const build = spawn("pnpm", ["build"], {
    cwd: projectRoot,
    env: { ...process.env, ...TASK20A_AUDIT_ENV },
    stdio: ["ignore", "pipe", "pipe"],
  })
  const result = await captureProcess(build)
  await writeFile(
    resolve(outputDirectory, "production-build.log"),
    result.output
  )
  if (result.exitCode !== 0) throw new Error("Task20A production build failed")
}

export async function startProductionServer(projectRoot) {
  const port = await reservePort()
  const serverProcess = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "-p",
      `${port}`,
    ],
    {
      cwd: projectRoot,
      detached: true,
      env: { ...process.env, ...TASK20A_AUDIT_ENV },
      stdio: ["ignore", "pipe", "pipe"],
    }
  )
  const origin = `http://127.0.0.1:${port}`
  try {
    await waitForServer(origin, serverProcess)
    return { origin, port, process: serverProcess }
  } catch (error) {
    await stopProcess(
      serverProcess,
      "production server after readiness failure"
    )
    throw error
  }
}

export async function stopProcess(child, label) {
  if (child.exitCode !== null || !child.pid) return
  globalThis.process.kill(-child.pid, "SIGTERM")
  const exited = await Promise.race([
    new Promise((resolvePromise) =>
      child.once("exit", () => resolvePromise(true))
    ),
    new Promise((resolvePromise) =>
      setTimeout(() => resolvePromise(false), 10_000)
    ),
  ])
  if (!exited && child.exitCode === null)
    globalThis.process.kill(-child.pid, "SIGKILL")
  if (child.exitCode === null) throw new Error(`${label} did not terminate`)
}

async function reservePort() {
  const server = createServer()
  await new Promise((resolvePromise, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", resolvePromise)
  })
  const address = server.address()
  server.close()
  if (!address || typeof address === "string")
    throw new Error("Could not reserve a loopback port")
  return address.port
}

async function waitForServer(origin, process) {
  const deadline = Date.now() + SERVER_TIMEOUT_MS
  while (Date.now() < deadline) {
    if (process.exitCode !== null)
      throw new Error("Production server exited before ready")
    try {
      const response = await fetch(origin, {
        signal: AbortSignal.timeout(1_000),
      })
      if (response.ok) return
    } catch {
      // no-excuse-ok: catch -- bounded startup polling intentionally retries connection refusal.
    }
  }
  throw new Error("Production server did not become ready within 60 seconds")
}

async function captureProcess(process) {
  let output = ""
  process.stdout.on("data", (chunk) => {
    output += chunk
  })
  process.stderr.on("data", (chunk) => {
    output += chunk
  })
  const exitCode = await new Promise((resolvePromise) => {
    process.once("exit", (code) => resolvePromise(code ?? 1))
  })
  return { exitCode, output }
}
