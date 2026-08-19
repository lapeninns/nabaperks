import { pathToFileURL } from "node:url"
import { resolve as resolvePath } from "node:path"

const root = resolvePath(process.cwd(), "qa-stress-loader")
const fakePostgresUrl = pathToFileURL(
  resolvePath(root, "fake-postgres.mjs")
).href
const fakeDisposableUrl = pathToFileURL(
  resolvePath(root, "fake-disposable.mjs")
).href

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "postgres")
    return { url: fakePostgresUrl, shortCircuit: true }
  if (specifier === "./disposable-db-target.mjs")
    return { url: fakeDisposableUrl, shortCircuit: true }
  return nextResolve(specifier, context)
}
