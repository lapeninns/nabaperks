import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { spawnSync } from "node:child_process"
import {
  readFileSync,
  mkdirSync,
  writeFileSync,
  copyFileSync,
  chmodSync,
  existsSync,
  mkdtempSync,
  rmSync,
} from "node:fs"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import { join, resolve, dirname } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { probeTreeDigest } from "../../../scripts/release/populated-upgrade.mjs"

const root = dirname(fileURLToPath(import.meta.url))
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex")

export function assertCompilerEnvironment(env = process.env) {
  for (const key of ["ESBUILD_BINARY_PATH", "NODE_OPTIONS", "NODE_PATH"]) {
    assert.ok(
      !Object.hasOwn(env, key),
      `Ambient compiler override forbidden: ${key}`
    )
  }
}

export function assertCleanRevision(source, revision, spawn = spawnSync) {
  assert.match(revision ?? "", /^[a-f0-9]{40}$/)
  assert.equal(resolve(source), source)
  const git = (args) => {
    const result = spawn("git", args, { cwd: source, encoding: "utf8" })
    assert.equal(result.status, 0, "Source git inspection failed")
    return result.stdout.trim()
  }
  assert.equal(
    git(["rev-parse", "HEAD"]),
    revision,
    "Source is not the expected full revision"
  )
  assert.equal(
    git(["status", "--porcelain", "--untracked-files=all"]),
    "",
    "Source tree must be clean"
  )
  return git(["rev-parse", "HEAD^{tree}"])
}

export async function compileProbe(source, revision, outfile) {
  assertCompilerEnvironment()
  const require = createRequire(join(source, "package.json"))
  const { build, version } = require("esbuild")
  const result = await build({
    entryPoints: [join(root, "probe/run.mjs")],
    outfile,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node24",
    metafile: true,
    define: { BUILD_REVISION: JSON.stringify(revision) },
    banner: {
      js: 'import { createRequire as __createRequire } from "node:module"; const require = __createRequire(import.meta.url);',
    },
    plugins: [
      {
        name: "explicit-disposable-transport",
        setup(build) {
          build.onResolve({ filter: /^server-only$/ }, () => ({
            path: "server-only",
            namespace: "empty",
          }))
          build.onLoad({ filter: /.*/, namespace: "empty" }, () => ({
            contents: "export {}",
          }))
          build.onResolve({ filter: /^@\/lib\/supabase\/server$/ }, () => ({
            path: join(root, "probe/database-adapter.mjs"),
          }))
          build.onResolve({ filter: /^@\/lib\/stripe\/server$/ }, () => ({
            path: "external-provider-forbidden",
            namespace: "provider",
          }))
          build.onLoad({ filter: /.*/, namespace: "provider" }, () => ({
            contents:
              'export function getStripe(){throw new Error("External Stripe access forbidden in upgrade probe")}',
          }))
          build.onResolve({ filter: /^@\// }, ({ path }) => {
            const relative = path.slice(2)
            assert.ok(!relative.split("/").includes(".."))
            const candidate = join(source, relative)
            for (const extension of [".ts", ".tsx", ".mjs", ".js"]) {
              if (existsSync(candidate + extension))
                return { path: candidate + extension }
            }
            throw new Error(`Unresolved pinned application module: ${relative}`)
          })
          build.onResolve({ filter: /^postgres$/ }, () => ({
            path: require.resolve("postgres"),
          }))
        },
      },
    ],
  })
  return { esbuildVersion: version, metafile: result.metafile }
}

export async function buildProbeArtifact({
  source,
  revision,
  output,
  runtimePath,
  runtimeDigest,
}) {
  assertCompilerEnvironment()
  const sourceTree = assertCleanRevision(source, revision)
  assert.equal(resolve(output), output)
  assert.ok(!existsSync(output), "Artifact output must not already exist")
  assert.equal(resolve(runtimePath), runtimePath)
  assert.match(runtimeDigest ?? "", /^[a-f0-9]{64}$/)
  assert.equal(
    hash(readFileSync(runtimePath)),
    runtimeDigest,
    "Runtime digest mismatch"
  )
  mkdirSync(output, { recursive: true })
  const artifactRoot = join(output, "artifact")
  mkdirSync(artifactRoot)
  // Never execute a compiler or dependency from the source checkout's ignored
  // node_modules. Export committed bytes and install the exact lockfile into a
  // fresh store in an isolated temporary build tree.
  const temporary = mkdtempSync(join(tmpdir(), "upgrade-probe-build-"))
  let build, inputs, installEvidence
  try {
    const exported = join(temporary, "source")
    mkdirSync(exported)
    const archive = spawnSync("git", ["archive", "--format=tar", revision], {
      cwd: source,
      maxBuffer: 128 * 1024 * 1024,
    })
    assert.equal(archive.status, 0, "Pinned source export failed")
    const extracted = spawnSync("tar", ["-xf", "-", "-C", exported], {
      input: archive.stdout,
    })
    assert.equal(extracted.status, 0, "Pinned source extraction failed")
    const packageJson = JSON.parse(
      readFileSync(join(exported, "package.json"), "utf8")
    )
    assert.match(packageJson.packageManager ?? "", /^pnpm@\d+\.\d+\.\d+$/)
    const environment = { PATH: process.env.PATH, HOME: temporary, CI: "1" }
    const version = spawnSync("pnpm", ["--version"], {
      env: environment,
      encoding: "utf8",
    })
    assert.equal(version.status, 0, "Pinned pnpm unavailable")
    assert.equal(
      version.stdout.trim(),
      packageJson.packageManager.slice(5),
      "pnpm version mismatch"
    )
    const args = [
      "install",
      "--frozen-lockfile",
      "--ignore-scripts",
      "--ignore-pnpmfile=true",
      "--store-dir",
      join(temporary, "store"),
      "--config.verify-store-integrity=true",
    ]
    const installed = spawnSync("pnpm", args, {
      cwd: exported,
      env: environment,
      encoding: "utf8",
      timeout: 600_000,
      maxBuffer: 16 * 1024 * 1024,
    })
    assert.ok(
      !installed.error && !installed.signal && installed.status === 0,
      "Fresh frozen dependency installation failed"
    )
    const lockDigest = hash(readFileSync(join(source, "pnpm-lock.yaml")))
    assert.equal(
      hash(readFileSync(join(exported, "pnpm-lock.yaml"))),
      lockDigest,
      "Dependency installation changed lockfile"
    )
    installEvidence = {
      packageManager: packageJson.packageManager,
      lockDigest,
      freshStore: true,
      frozenLockfile: true,
      lifecycleScripts: false,
      verifyStoreIntegrity: true,
      logDigest: hash(installed.stdout + installed.stderr),
    }
    build = await compileProbe(
      exported,
      revision,
      join(artifactRoot, "probe.mjs")
    )
    inputs = Object.keys(build.metafile.inputs)
      .filter(
        (path) => !path.startsWith("empty:") && !path.startsWith("provider:")
      )
      .map((path) => ({
        path: path.replace(exported, "<pinned-source>"),
        sha256: hash(readFileSync(resolve(path))),
      }))
  } finally {
    rmSync(temporary, { recursive: true, force: true })
  }
  copyFileSync(runtimePath, join(artifactRoot, "runtime"))
  assert.equal(
    hash(readFileSync(join(artifactRoot, "runtime"))),
    runtimeDigest,
    "Copied runtime digest changed"
  )
  chmodSync(join(artifactRoot, "runtime"), 0o755)
  copyFileSync(
    join(source, "pnpm-lock.yaml"),
    join(artifactRoot, "pnpm-lock.yaml")
  )
  writeFileSync(
    join(artifactRoot, "build-evidence.json"),
    JSON.stringify(
      {
        revision,
        sourceTree,
        runtimeDigest,
        esbuildVersion: build.esbuildVersion,
        dependencyInstallation: installEvidence,
        inputs,
        scope: "domain-app-functions-and-real-database-rpcs",
        transport: "postgres-adapter-replaces-supabase-http-only",
      },
      null,
      2
    ) + "\n"
  )
  assertCleanRevision(source, revision)
  const manifest = {
    schema: "nabaperks.upgrade-probe.v1",
    revision,
    databaseAdapter: "upgrade-database-url-only",
    runtime: "runtime",
    entrypoint: "probe.mjs",
    application: "probe.mjs",
    lockfile: "pnpm-lock.yaml",
    args: [],
    treeDigest: probeTreeDigest(artifactRoot),
  }
  const manifestPath = join(output, "manifest.json")
  const bytes = JSON.stringify(manifest, null, 2) + "\n"
  writeFileSync(manifestPath, bytes)
  return { revision, artifactRoot, manifestPath, manifestDigest: hash(bytes) }
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  try {
    assert.equal(process.argv.length, 3, "Configuration JSON required")
    console.log(
      JSON.stringify(
        await buildProbeArtifact(
          JSON.parse(readFileSync(process.argv[2], "utf8"))
        )
      )
    )
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
