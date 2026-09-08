import { isDeepStrictEqual } from "node:util"

// Only these reviewed operator/test entry points may differ. Production hooks
// and all other package metadata remain part of the runtime comparison.
const OPERATOR_SCRIPTS = new Set([
  "test:contracts",
  "test:unit",
  "test:coverage",
  "ops:factory:status",
  "ops:factory:action",
  "ops:ci:benchmark",
])
const PRODUCTION_SCRIPTS = {
  prepare: "husky",
  build: "pnpm secrets:check && next build --webpack",
  start: "next start",
  "secrets:check": "node scripts/check-credential-backups.mjs",
}
const LIFECYCLE_HOOKS = [
  "preinstall",
  "install",
  "postinstall",
  "prepublish",
  "preprepare",
  "postprepare",
  "prepublishOnly",
  "prepack",
  "postpack",
  "publish",
  "postpublish",
  "prebuild",
  "postbuild",
  "prestart",
  "poststart",
  "vercel-build",
  "presecrets:check",
  "postsecrets:check",
]
const object = (value) =>
  value && typeof value === "object" && !Array.isArray(value)

function runtimePackage(contents) {
  if (typeof contents !== "string" || Buffer.byteLength(contents) > 32768)
    return null
  const manifest = JSON.parse(contents)
  if (
    !object(manifest) ||
    !object(manifest.scripts) ||
    !Object.values(manifest.scripts).every((value) => typeof value === "string")
  )
    return null
  // Do not infer arbitrary shell-script dependency graphs. This exception is
  // valid only for the audited production entry points and absent extra hooks.
  if (
    Object.entries(PRODUCTION_SCRIPTS).some(
      ([name, command]) => manifest.scripts[name] !== command
    ) ||
    LIFECYCLE_HOOKS.some((name) => Object.hasOwn(manifest.scripts, name))
  )
    return null
  return {
    ...manifest,
    scripts: Object.fromEntries(
      Object.entries(manifest.scripts).filter(
        ([name]) => !OPERATOR_SCRIPTS.has(name)
      )
    ),
  }
}

/** Evidence is exact Git blob text; every later stage rereads both revisions. */
export function isOperatorPackageComparison(comparison) {
  try {
    if (
      !object(comparison) ||
      !isDeepStrictEqual(Object.keys(comparison).sort(), [
        "baseline",
        "candidate",
        "schema",
      ]) ||
      comparison.schema !== "nabaperks.operator-package-comparison.v1"
    )
      return false
    const before = runtimePackage(comparison.baseline)
    const after = runtimePackage(comparison.candidate)
    return before !== null && after !== null && isDeepStrictEqual(before, after)
  } catch {
    return false
  }
}
