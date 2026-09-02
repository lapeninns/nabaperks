import assert from "node:assert/strict"
import { test } from "node:test"
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  symlink,
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

  const result = await withStagedOutputDirectory(
    output,
    async (stagedRoot) => {
      await mkdir(path.join(stagedRoot, "current-venue"), { recursive: true })
      await writeFile(
        path.join(stagedRoot, "_manifest.json"),
        '{"version":"current"}\n'
      )
      return "promoted"
    },
    root
  )

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
    withStagedOutputDirectory(
      output,
      async (stagedRoot) => {
        await mkdir(path.join(stagedRoot, "partial-venue"), { recursive: true })
        throw new Error("preview render failed")
      },
      root
    ),
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

  await recoverInterruptedOutputDirectory(output, root)

  assert.match(
    await readFile(path.join(output, "_manifest.json"), "utf8"),
    /old/
  )
  await assert.rejects(readFile(path.join(backup, "_manifest.json"), "utf8"))
})

test("output directories containing the working tree are rejected", async () => {
  const ancestor = path.resolve(process.cwd(), "..")
  await assert.rejects(
    withStagedOutputDirectory(ancestor, async () => "never"),
    /Refusing (?:to replace unsafe output directory|output outside the dedicated print-kit base)/
  )
  await assert.rejects(
    recoverInterruptedOutputDirectory(ancestor),
    /Refusing (?:to replace unsafe output directory|output outside the dedicated print-kit base)/
  )
})

test("abandoned staging trees are reclaimed before a new render", async (t) => {
  const root = await temporaryRoot(t)
  const output = path.join(root, "posters")
  const abandoned = path.join(root, ".posters.staging-abandoned")
  await mkdir(abandoned, { recursive: true })
  await writeFile(path.join(abandoned, "half-rendered.pdf"), "stale")

  await withStagedOutputDirectory(
    output,
    async (stagedRoot) => {
      await writeFile(path.join(stagedRoot, "_manifest.json"), "{}\n")
      return "promoted"
    },
    root
  )

  const leftovers = (await readdir(root)).filter((entry) =>
    entry.startsWith(".posters.staging-")
  )
  assert.deepEqual(leftovers, [])
})

test("a symlinked parent cannot disguise the working tree as a safe output", async (t) => {
  const root = await temporaryRoot(t)
  const protectedTree = path.join(root, "protected-repository")
  const alias = path.join(root, "alias")
  const sentinel = path.join(protectedTree, "sentinel.txt")
  await mkdir(protectedTree)
  await writeFile(sentinel, "keep me")
  await symlink(root, alias, "dir")

  const originalCwd = process.cwd()
  process.chdir(protectedTree)
  try {
    await assert.rejects(
      withStagedOutputDirectory(
        path.join(alias, "protected-repository"),
        async () => "never",
        root
      ),
      /symlinked print-kit output path/
    )
  } finally {
    process.chdir(originalCwd)
  }

  assert.equal(await readFile(sentinel, "utf8"), "keep me")
})

test("a final output symlink is rejected without touching its target", async (t) => {
  const root = await temporaryRoot(t)
  const protectedTree = path.join(root, "protected")
  const sentinel = path.join(protectedTree, "sentinel.txt")
  const output = path.join(root, "posters")
  await mkdir(protectedTree)
  await writeFile(sentinel, "keep me")
  await symlink(protectedTree, output, "dir")

  await assert.rejects(
    withStagedOutputDirectory(output, async () => "never", root),
    /symbolic link as the print-kit output directory/
  )

  assert.equal(await readFile(sentinel, "utf8"), "keep me")
})

test("promotion stops if the prepared parent is substituted during rendering", async (t) => {
  const root = await temporaryRoot(t)
  const parent = path.join(root, "exports")
  const movedParent = path.join(root, "exports-moved")
  const attackerTree = path.join(root, "attacker")
  const sentinel = path.join(attackerTree, "sentinel.txt")
  await mkdir(parent)
  await mkdir(attackerTree)
  await writeFile(sentinel, "keep me")

  await assert.rejects(
    withStagedOutputDirectory(
      path.join(parent, "posters"),
      async () => {
        await rename(parent, movedParent)
        await symlink(attackerTree, parent, "dir")
        return "never promoted"
      },
      root
    ),
    /output parent changed/
  )

  assert.equal(await readFile(sentinel, "utf8"), "keep me")
  await assert.rejects(readFile(path.join(attackerTree, "posters"), "utf8"))
})

test("a symlinked parent cannot redirect output into another protected tree", async (t) => {
  const root = await temporaryRoot(t)
  const protectedParent = path.join(root, "protected")
  const protectedOutput = path.join(protectedParent, "victim")
  const alias = path.join(root, "alias")
  const sentinel = path.join(protectedOutput, "sentinel.txt")
  await mkdir(protectedOutput, { recursive: true })
  await writeFile(sentinel, "keep me")
  await symlink(protectedParent, alias, "dir")

  await assert.rejects(
    withStagedOutputDirectory(
      path.join(alias, "victim"),
      async (stagedRoot) => {
        await writeFile(path.join(stagedRoot, "replacement.txt"), "bad")
      },
      root
    ),
    /symlinked print-kit output path/
  )

  assert.equal(await readFile(sentinel, "utf8"), "keep me")
})
