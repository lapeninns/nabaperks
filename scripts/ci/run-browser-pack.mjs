import { mkdirSync, writeFileSync } from "node:fs"
import { resolve, join } from "node:path"
import { pathToFileURL } from "node:url"
import { runBrowserPack, comparePackInventory } from "./browser-pack.mjs"

// A pack is nothing more than a grouping of whole /32 shards: the denominator
// stays at thirty-two, so Playwright's distribution of specs across shards is
// byte-identical to the original thirty-two-job matrix and the executed test
// set cannot move. Only the number of GitHub jobs that carry those shards
// changes.
//
// Widening a pack from four shards to eight halves the e2e job count (33 -> 16)
// and with it the per-job setup tax. Measured on run 34290952137 (main
// d5f5c3641), the e2e matrix spent 92.3 machine-minutes across 32 matrix jobs
// of which 28.8 were setup - checkout, ./.github/actions/setup, container pull
// and browser verification, roughly 54s paid once per job rather than once per
// shard. Sixteen jobs model at 77.2 machine-minutes, a saving of 15.1; with the
// a11y tier's 7.2 the whole run models at 131.8 against 154.1, about 14%.
//
// The saving is bought with a little wall clock, and that is a deliberate
// trade, not an oversight. Packs are consecutive blocks, so new pack 1 is
// exactly old packs 1 and 2 - and old pack 1 is consistently the heaviest,
// because Playwright fills the low shards first. Replaying the real per-job
// timings through this grouping puts the slowest packed e2e job at about 376s
// (desktop-firefox), up from 239s, against a whole-run wall of 369s whose
// critical path was Lighthouse at 361s. The critical path therefore moves to a
// packed e2e job and the run gets roughly 15s longer. Twenty-two machine-
// minutes for about 4% of wall clock is the bargain being struck; if that ever
// stops being worth it, pair the heavy and light halves (1+8, 2+7, 3+6, 4+5)
// instead, which models at 367s for identical machine-minutes but costs this
// file its one-line tiling proof.
//
// Eight is safe for memory because a pack is sequential, never shared: each
// shard inside it still gets its own fresh Playwright server and verified
// wrapper cleanup (see runBrowserPack), which is exactly what keeps a job away
// from the out-of-memory kill an unsharded run hits after roughly 154 tests.
// Grouping must never be allowed to mean sharing one server.
export const PACK_COUNT = 4
export const PACK_SHARD_COUNT = 8
export const BROWSER_SHARD_TOTAL = 32

// Consecutive, equally sized blocks tile 1/32..32/32 exactly once - no gaps and
// no duplicates - precisely when the three constants agree. Assert that at load
// rather than trusting the arithmetic below to stay in step with them.
if (PACK_COUNT * PACK_SHARD_COUNT !== BROWSER_SHARD_TOTAL)
  throw new Error("Packs must cover every original shard exactly once")

export function packShards(pack) {
  if (!/^[1-4]$/.test(String(pack)))
    throw new Error("Pack must be an integer from 1 to 4")
  return Array.from(
    { length: PACK_SHARD_COUNT },
    (_, index) =>
      `${(Number(pack) - 1) * PACK_SHARD_COUNT + index + 1}/${BROWSER_SHARD_TOTAL}`
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
        "Usage: run-browser-pack.mjs <project> <1-4> <new-output-directory>"
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
