#!/usr/bin/env node
// Vendors the canonical starter kit into the self-contained skill bundles so
// every distribution (the repo's `.factory/skills` plus the per-agent home
// directories — Claude `~/.claude/skills`, droid `~/.factory/skills`, Codex
// `~/.codex/skills`, and the shared `~/.agents/skills`) ships the exact same
// installer + templates, and mirrors the kit's station skills
// (`skills/<name>/`) to top-level skill directories next to each bundle so
// they are discoverable — skill discovery is one level deep, so the copies
// nested inside the vendored kit are inert. The kit is canonical for ALL
// skill content, including SKILL.md.
//
// It also enforces LOCKSTEP for the repo's own governance engine and shared
// tests: every ENGINE_FILES entry under scripts/ and every SHARED_TEST_FILES
// entry under tests/micro-specs/ is copied from (and byte-compared against)
// the canonical kit templates. governance-constants.mjs is the one engine
// file that may differ — it carries the repo tuning; the enforcement-test
// flavors legitimately differ and stay dual-edited.
//
// Ownership guard: a suite mirror is deleted and recreated only when its
// existing SKILL.md carries the `managed-by: ai-governance-starter-kit`
// marker. `~/.claude/skills` is a user-owned namespace — an unmarked
// directory at a mirror path is a collision, and the sync refuses.
//
// Guard: the kit is canonical, but a lockstep target with UNCOMMITTED edits
// that differ from its template is someone's work in flight — the sync
// refuses it (exit 1) instead of silently clobbering; port the edits into
// the kit template first, or pass --force to discard them deliberately.
//
// Usage:
//   node scripts/sync-skill-bundles.mjs                # sync .factory bundle, mirrors, repo engine/tests
//   node scripts/sync-skill-bundles.mjs --check        # fail (exit 1) on any drift
//   node scripts/sync-skill-bundles.mjs --force        # overwrite dirty lockstep targets
//   node scripts/sync-skill-bundles.mjs --all-homes    # also refresh every agent home below
//   node scripts/sync-skill-bundles.mjs --claude-home  # ~/.claude/skills (Claude Code)
//   node scripts/sync-skill-bundles.mjs --factory-home # ~/.factory/skills (droid)
//   node scripts/sync-skill-bundles.mjs --codex-home   # ~/.codex/skills (Codex)
//   node scripts/sync-skill-bundles.mjs --agents-home  # ~/.agents/skills (cross-agent)
//
// GOVERNANCE_SYNC_ROOT overrides the repo root (test harness escape hatch).
import { execFileSync } from "node:child_process"
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"

import { ENGINE_FILES, SHARED_TEST_FILES } from "./governance-version.mjs"

const MANAGED_BY_MARKER = "managed-by: ai-governance-starter-kit"

const repoRoot =
  process.env.GOVERNANCE_SYNC_ROOT ?? join(dirname(fileURLToPath(import.meta.url)), "..")
const args = process.argv.slice(2)
const check = args.includes("--check")
const force = args.includes("--force")

const sourceKit = join(repoRoot, "ai-governance-starter-kit")
const sourceSkillMd = join(sourceKit, "SKILL.md")
const suiteRoot = join(sourceKit, "skills")

// Per-agent home skill roots on this machine; each is opt-in by flag (or all
// at once) so CI and plain repo syncs never touch the user's home directory.
const HOME_ROOTS = [
  ["--claude-home", ".claude/skills"],
  ["--factory-home", ".factory/skills"],
  ["--codex-home", ".codex/skills"],
  ["--agents-home", ".agents/skills"],
]

const skillsRoots = [join(repoRoot, ".factory/skills")]
for (const [flag, homePath] of HOME_ROOTS) {
  if (args.includes(flag) || args.includes("--all-homes")) {
    skillsRoots.push(join(homedir(), homePath))
  }
}

const suiteSkills = existsSync(suiteRoot)
  ? readdirSync(suiteRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
  : []

let drift = false
let refusals = 0

for (const skillsRootPath of skillsRoots) {
  const bundleDir = join(skillsRootPath, "ai-governance-starter-kit")
  const kitTarget = join(bundleDir, "ai-governance-starter-kit")
  const skillMdTarget = join(bundleDir, "SKILL.md")

  if (check) {
    if (treeDiffers(sourceKit, kitTarget)) {
      console.error(`Drift: ${label(kitTarget)} is out of sync with ${relative(repoRoot, sourceKit)}.`)
      drift = true
    }
    if (fileDiffers(sourceSkillMd, skillMdTarget)) {
      console.error(`Drift: ${label(skillMdTarget)} is out of sync with the kit SKILL.md.`)
      drift = true
    }
  } else {
    rmSync(kitTarget, { recursive: true, force: true })
    mkdirSync(bundleDir, { recursive: true })
    cpSync(sourceKit, kitTarget, { recursive: true })
    cpSync(sourceSkillMd, skillMdTarget)
    console.log(`Synced ${label(bundleDir)} <- ${relative(repoRoot, sourceKit)}`)
  }

  for (const name of suiteSkills) {
    const source = join(suiteRoot, name)
    const target = join(skillsRootPath, name)

    if (check) {
      if (treeDiffers(source, target)) {
        console.error(`Drift: ${label(target)} suite mirror is out of sync.`)
        drift = true
      }
      continue
    }

    if (existsSync(target) && !carriesMarker(target)) {
      console.error(
        `Refusing to overwrite ${label(target)}: its SKILL.md does not carry "${MANAGED_BY_MARKER}", so it is not ours to manage. Move it aside or add the marker deliberately.`
      )
      process.exit(1)
    }
    rmSync(target, { recursive: true, force: true })
    cpSync(source, target, { recursive: true })
  }
  if (!check && suiteSkills.length > 0) {
    console.log(`Mirrored ${suiteSkills.length} station skill(s) into ${label(skillsRootPath)}.`)
  }
}

// Lockstep: repo engine files and shared tests must match the kit templates.
syncLockstep(join(sourceKit, "templates/scripts"), join(repoRoot, "scripts"), ENGINE_FILES, "scripts")
syncLockstep(
  join(sourceKit, "templates/tests/micro-specs"),
  join(repoRoot, "tests/micro-specs"),
  SHARED_TEST_FILES,
  "tests/micro-specs"
)

if (check && drift) {
  console.error('\nRun "node scripts/sync-skill-bundles.mjs" to refresh the bundles.')
  process.exit(1)
}
if (!check && drift) process.exit(1)
if (refusals > 0) {
  console.error(
    `\n${refusals} lockstep file(s) refused (uncommitted edits); everything else was synced.`
  )
  process.exit(1)
}
if (check) console.log("Skill bundles are in sync.")

function syncLockstep(sourceDir, targetDir, files, prefix) {
  for (const file of files) {
    const source = join(sourceDir, file)
    const target = join(targetDir, file)

    if (!existsSync(source)) {
      console.error(`Lockstep file missing from kit templates: ${prefix}/${file}`)
      drift = true
      continue
    }

    if (check) {
      if (fileDiffers(source, target)) {
        console.error(`Drift: ${prefix}/${file} differs from the kit template.`)
        drift = true
      }
      continue
    }

    // A committed difference is normal kit propagation; a DIRTY difference is
    // uncommitted work about to be destroyed — refuse it (kit is canonical).
    if (
      !force &&
      fileDiffers(source, target) &&
      gitDirty(repoRoot, `${prefix}/${file}`)
    ) {
      console.error(
        `Refusing to overwrite ${prefix}/${file}: it has uncommitted edits that differ from the kit template. The kit is canonical — port your edits into ${relative(repoRoot, sourceDir)}/${file} first, or re-run with --force to discard them.`
      )
      refusals += 1
      continue
    }

    cpSync(source, target)
  }
  if (!check) console.log(`Synced ${files.length} ${prefix} lockstep file(s).`)
}

// Uncommitted state (modified, staged, or untracked-with-content) for one
// path. Fail-open when git cannot answer: propagation is the primary job.
function gitDirty(root, relPath) {
  try {
    return (
      execFileSync("git", ["status", "--porcelain", "--", relPath], {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim().length > 0
    )
  } catch {
    return false
  }
}

function carriesMarker(dir) {
  const skillMd = join(dir, "SKILL.md")
  if (!existsSync(skillMd)) return false
  return readFileSync(skillMd, "utf8").includes(MANAGED_BY_MARKER)
}

function label(target) {
  const home = homedir()
  if (target.startsWith(`${repoRoot}/`)) return relative(repoRoot, target)
  if (target.startsWith(home)) return `~${target.slice(home.length)}`
  return target
}

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
