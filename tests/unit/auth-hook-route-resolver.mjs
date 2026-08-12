import { pathToFileURL } from "node:url"

const nextServer = pathToFileURL(
  `${process.cwd()}/node_modules/next/server.js`
).href

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "next/server") {
    return nextResolve(nextServer, context)
  }
  return nextResolve(specifier, context)
}
