import { mkdirSync, writeFileSync } from "node:fs"
import { resolve, join } from "node:path"
import { pathToFileURL } from "node:url"
import { runBrowserPack, comparePackInventory } from "./browser-pack.mjs"

export function packShards(pack) {
  if (!/^[1-8]$/.test(String(pack)))
    throw new Error("Pack must be an integer from 1 to 8")
  return Array.from(
    { length: 4 },
    (_, index) => `${(Number(pack) - 1) * 4 + index + 1}/32`
  )
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const [project, pack, output, ...extra] = process.argv.slice(2)
    if (!output || extra.length)
      throw new Error(
        "Usage: run-browser-pack.mjs <project> <1-8> <new-output-directory>"
      )
    const shards = packShards(pack)
    const root = resolve(output)
    mkdirSync(root)
    const listed = await runBrowserPack({
      project,
      shards,
      output: join(root, "listed"),
      listOnly: true,
    })
    const runtime = await runBrowserPack({
      project,
      shards,
      output: join(root, "runtime"),
    })
    const inventory = comparePackInventory(listed, runtime)
    if (!inventory.equivalent)
      throw new Error(
        "Executed test inventory differs from the original shard selection"
      )
    writeFileSync(
      join(root, "summary.json"),
      JSON.stringify(
        {
          project,
          pack: Number(pack),
          shards,
          inventory,
          tests: runtime.results.reduce(
            (total, result) => total + result.tests.length,
            0
          ),
          durationMs: runtime.results.reduce(
            (total, result) => total + result.durationMs,
            0
          ),
        },
        null,
        2
      ) + "\n"
    )
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
