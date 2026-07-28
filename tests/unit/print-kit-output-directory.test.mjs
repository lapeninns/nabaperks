import assert from "node:assert/strict"
import { test } from "node:test"
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

import {
  recoverInterruptedOutputDirectory,
  withStagedOutputDirectory,
} from "@/lib/notifications/print-kit-output-directory"

async function temporaryRoot(t) {
  const root = await mkdtemp(path.join(tmpdir(), "nabaperks-print-output-"))
  t.after(() => rm(root, { recursive: true, force: true }))
  return root
}

test("successful print-kit promotion replaces stale venues as one tree", async (t) => {
  const root = await temporaryRoot(t)
  const output = path.join(root, "posters")
  await mkdir(path.join(output, "stale-venue"), { recursive: true })
  await writeFile(path.join(output, "_manifest.json"), '{"version":"old"}\n')

  const result = await withStagedOutputDirectory(output, async (stagedRoot) => {
    await mkdir(path.join(stagedRoot, "current-venue"), { recursive: true })
    await writeFile(
      path.join(stagedRoot, "_manifest.json"),
      '{"version":"current"}\n'
    )
    return "promoted"
  })

  assert.equal(result, "promoted")
  assert.deepEqual((await readdir(output)).sort(), [
    "_manifest.json",
    "current-venue",
  ])
  assert.match(
    await readFile(path.join(output, "_manifest.json"), "utf8"),
    /current/
  )
  assert.deepEqual(
    (await readdir(root)).filter((entry) => entry.startsWith(".posters.")),
    []
  )
})

test("failed print-kit render preserves the last coherent output", async (t) => {
  const root = await temporaryRoot(t)
  const output = path.join(root, "posters")
  await mkdir(path.join(output, "published-venue"), { recursive: true })
  await writeFile(path.join(output, "_manifest.json"), '{"version":"old"}\n')

  await assert.rejects(
    withStagedOutputDirectory(output, async (stagedRoot) => {
      await mkdir(path.join(stagedRoot, "partial-venue"), { recursive: true })
      throw new Error("preview render failed")
    }),
    /preview render failed/
  )

  assert.deepEqual((await readdir(output)).sort(), [
    "_manifest.json",
    "published-venue",
  ])
  assert.match(
    await readFile(path.join(output, "_manifest.json"), "utf8"),
    /old/
  )
  assert.deepEqual(
    (await readdir(root)).filter((entry) => entry.startsWith(".posters.")),
    []
  )
})

test("next export restores an output interrupted during promotion", async (t) => {
  const root = await temporaryRoot(t)
  const output = path.join(root, "posters")
  const backup = path.join(root, ".posters.previous")
  await mkdir(output)
  await writeFile(path.join(output, "_manifest.json"), '{"version":"old"}\n')
  await rename(output, backup)

  await recoverInterruptedOutputDirectory(output)

  assert.match(
    await readFile(path.join(output, "_manifest.json"), "utf8"),
    /old/
  )
  await assert.rejects(readFile(path.join(backup, "_manifest.json"), "utf8"))
})
