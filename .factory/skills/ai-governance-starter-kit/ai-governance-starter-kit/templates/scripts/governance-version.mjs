// Kit version + the engine-file manifest.
//
// ENGINE_FILES is the lockstep contract: these files under scripts/ must be
// byte-identical to the canonical kit copies in
// ai-governance-starter-kit/templates/scripts/ (and, transitively, to every
// distributed skill bundle). governance-constants.mjs is deliberately NOT
// here — it is the single per-repo tuning point; only its export SHAPE is
// held equal to the kit's.
//
// The installer treats this same list as "engine-owned" during --upgrade:
// safe to overwrite (with backups), unlike seed files a repo adapts.

export const KIT_VERSION = "0.3.0"

export const ENGINE_FILES = Object.freeze([
  "advance-spec.mjs",
  "check-governance.mjs",
  "governance-commands.mjs",
  "governance-evidence.mjs",
  "governance-frontmatter.mjs",
  "governance-glob.mjs",
  "governance-io.mjs",
  "governance-rules.mjs",
  "governance-version.mjs",
  "new-spec.mjs",
  "run-governance-gates.mjs",
])

// Shared test files under tests/micro-specs/: byte-identical between the kit
// templates and a repo that hosts the kit, same lockstep discipline as
// ENGINE_FILES. governance-enforcement.test.mjs is deliberately absent — the
// kit and host-repo flavors legitimately differ and stay dual-edited.
export const SHARED_TEST_FILES = Object.freeze([
  "advance-spec.test.mjs",
  "governance-evidence.test.mjs",
  "new-spec.test.mjs",
])
