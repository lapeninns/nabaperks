/**
 * Node ESM resolve hook that maps the project's `@/*` tsconfig path alias to the
 * repo root so unit tests can import source `.ts` modules directly. Node strips
 * the TypeScript types on load (Node >= 22.6 / default in 24); type-only imports
 * are erased before resolution, so importing a pure module never pulls in its
 * `server-only` type dependencies.
 *
 * Used only by the test runner (see register-alias.mjs); production builds resolve
 * `@/*` through tsconfig + the bundler, never through this hook.
 */
import { existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const EXTENSIONS = [".ts", ".tsx", ".mts", ".js", ".mjs"]

function resolveAliasTarget(specifier) {
  const base = path.join(root, specifier.slice(2))
  const fileHit = EXTENSIONS.map((ext) => base + ext).find(existsSync)
  if (fileHit) {
    return fileHit
  }

  return [path.join(base, "index.ts"), path.join(base, "index.tsx")].find(
    existsSync
  )
}

function resolveRelativeTarget(specifier, parentURL) {
  if (!parentURL?.startsWith("file:")) return null

  const base = fileURLToPath(new URL(specifier, parentURL))
  const fileHit = EXTENSIONS.map((ext) => base + ext).find(existsSync)
  if (fileHit) {
    return fileHit
  }

  return [path.join(base, "index.ts"), path.join(base, "index.tsx")].find(
    existsSync
  )
}

export async function resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) {
    const target = resolveAliasTarget(specifier)
    if (target) {
      return next(pathToFileURL(target).href, context)
    }
  }

  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    const target = resolveRelativeTarget(specifier, context.parentURL)
    if (target) {
      return next(pathToFileURL(target).href, context)
    }
  }

  return next(specifier, context)
}
