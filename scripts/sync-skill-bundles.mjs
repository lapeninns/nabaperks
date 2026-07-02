#!/usr/bin/env node
// Vendors the canonical starter kit into the self-contained skill bundles so
// every distribution (Factory `.factory/skills`, Claude `~/.claude/skills`)
// ships the exact same installer + templates. A skill directory must carry its
// own installer — the SKILL.md cannot assume the target repo has a copy.
//
// Usage:
//   node scripts/sync-skill-bundles.mjs            # sync the in-repo .factory bundle
//   node scripts/sync-skill-bundles.mjs --check    # fail (exit 1) if the bundle is stale
//   node scripts/sync-skill-bundles.mjs --claude-home  # also refresh ~/.claude/skills
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..")
const args = process.argv.slice(2)
const check = args.includes("--check")

const sourceKit = join(repoRoot, "ai-governance-starter-kit")
const sourceSkill = join(repoRoot, ".factory/skills/ai-governance-starter-kit/SKILL.md")

const bundles = [
  {
    label: ".factory skill bundle",
    skillDir: join(repoRoot, ".factory/skills/ai-governance-starter-kit"),
    syncSkillMd: false, // SKILL.md there is the canonical source; do not overwrite it
  },
]

if (args.includes("--claude-home")) {
  bundles.push({
    label: "~/.claude skill bundle",
    skillDir: join(homedir(), ".claude/skills/ai-governance-starter-kit"),
    syncSkillMd: true,
  })
}

let drift = false

for (const bundle of bundles) {
  const kitTarget = join(bundle.skillDir, "ai-governance-starter-kit")
  const skillMdTarget = join(bundle.skillDir, "SKILL.md")

  if (check) {
    if (treeDiffers(sourceKit, kitTarget)) {
      console.error(`Drift: ${bundle.label} kit is out of sync with ${relative(repoRoot, sourceKit)}.`)
      drift = true
    }
    if (bundle.syncSkillMd && fileDiffers(sourceSkill, skillMdTarget)) {
      console.error(`Drift: ${bundle.label} SKILL.md is out of sync.`)
      drift = true
    }
    continue
  }

  rmSync(kitTarget, { recursive: true, force: true })
  mkdirSync(bundle.skillDir, { recursive: true })
  cpSync(sourceKit, kitTarget, { recursive: true })
  if (bundle.syncSkillMd) cpSync(sourceSkill, skillMdTarget)
  console.log(`Synced ${bundle.label} <- ${relative(repoRoot, sourceKit)}`)
}

if (check && drift) {
  console.error('\nRun "node scripts/sync-skill-bundles.mjs" to refresh the bundles.')
  process.exit(1)
}
if (check) console.log("Skill bundles are in sync.")

function listFiles(dir, base = dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const absolute = join(dir, entry.name)
      if (entry.isDirectory()) return listFiles(absolute, base)
      return [relative(base, absolute)]
    })
    .sort()
}

function treeDiffers(source, target) {
  if (!existsSync(target)) return true
  const sourceFiles = listFiles(source)
  const targetFiles = listFiles(target)
  if (sourceFiles.join("\n") !== targetFiles.join("\n")) return true
  return sourceFiles.some((file) =>
    readFileSync(join(source, file), "utf8") !== readFileSync(join(target, file), "utf8")
  )
}

function fileDiffers(source, target) {
  if (!existsSync(target)) return true
  return readFileSync(source, "utf8") !== readFileSync(target, "utf8")
}
