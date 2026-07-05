---
name: ai-governance-starter-kit
description: The AI-software-factory governance suite — Micro-Spec intake, TDD gates, tracked evidence ledgers, machine-enforced lifecycle. Use when the user asks to add AI governance or Micro-Specs to a repository, or wants to author, implement, verify, close, or heal a Micro-Spec; this routes to the station skill that does it.
user-invocable: true
disable-model-invocation: false
managed-by: ai-governance-starter-kit
---

# AI Governance Starter Kit

A closed factory loop for agent-built software: every change enters as a
Micro-Spec, ships through recorded gate runs, and ends as a durable rationale
record. The engine enforces it per pull request — strict spec metadata,
risk-class gate floors, blast radius, docs drift, exception expiry, and an
evidence ledger where hand-flipped statuses and doctored runs fail.

## Which skill when

- [write-micro-spec](skills/write-micro-spec/SKILL.md) — new work needs a
  contract: grill, slice at seams, scaffold, activate.
- [implement-micro-spec](skills/implement-micro-spec/SKILL.md) — an active
  spec exists: narrow first, red -> green -> refactor, record proof, advance
  to implemented.
- [close-micro-spec](skills/close-micro-spec/SKILL.md) — shipped work:
  verify with attestations and acks, rewrite the plan into a rationale
  record, advance to closed.
- [install-governance](skills/install-governance/SKILL.md) — the target repo
  lacks the factory, or an existing install needs upgrading.

## Lifecycle at a glance

```
new-spec -> draft -> active -> implemented -> verified -> closed
   (advance runs the gates fresh and writes the ledger at every arrow;
    superseded is the exit ramp from any post-draft status)
```

## Self-contained install

The installer and templates are bundled next to this file under
`ai-governance-starter-kit/`; install-governance locates and runs them —
never assume the target repo has a copy.

## Distribution

The kit directory is a Claude Code plugin root (`.claude-plugin/plugin.json`
declares it; the four station skills live under `skills/`). Publishing note:
`npx skills add` and plugin marketplaces need the kit exported as its own
public repository root — this manifest ships ready for that export, and no
manifest exists at the product repo's root on purpose.

## Maintainers

The kit is canonical for ALL skill content, including this file. After
editing anything under the kit: `node scripts/sync-skill-bundles.mjs`
(add `--all-homes` to also refresh the agent homes on this machine —
`~/.claude`, `~/.factory`, `~/.codex`, `~/.agents` — or a single
`--claude-home` / `--factory-home` / `--codex-home` / `--agents-home`);
the drift-guard test fails CI when bundles, suite mirrors, or shared
tests diverge.
