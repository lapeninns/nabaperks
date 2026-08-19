# Nabaperks QA certification handoff

This visible file points to the complete local QA evidence package. The evidence itself lives under `.omo/`, which is intentionally hidden and ignored by Git.

## Current state

- Branch: `main`
- Evaluated commit: `f9be041a9185f7cf3f2ee4518f397f876f090d96`
- Plan progress: 44 of 44 top-level investigations completed
- Certification verdict: **NOT_CERTIFIED**
- Boulder state: `abandoned`, not completed
- Tracked and staged source diffs: empty
- Pre-existing untracked file preserved: `classifier.mjs`
- Retained QA worktree: `/private/tmp/nabaperks-t1-fourth.cZeng79d/nabaperks-qa`

## Local evidence

- Complete evidence root: `.omo/evidence/whole-repo-qa/f9be041a9185f7cf3f2ee4518f397f876f090d96-20260809T151939Z/`
- Consolidation package: `.omo/evidence/whole-repo-qa/f9be041a9185f7cf3f2ee4518f397f876f090d96-20260809T151939Z/handoff/main-consolidation-v1/`
- Full successor prompt: `.omo/evidence/whole-repo-qa/f9be041a9185f7cf3f2ee4518f397f876f090d96-20260809T151939Z/handoff/main-consolidation-v1/HANDOFF_PROMPT.md`
- Consolidation receipt: `.omo/evidence/whole-repo-qa/f9be041a9185f7cf3f2ee4518f397f876f090d96-20260809T151939Z/handoff/main-consolidation-v1/consolidation-receipt.json`
- Integrity manifest: `.omo/evidence/whole-repo-qa/f9be041a9185f7cf3f2ee4518f397f876f090d96-20260809T151939Z/handoff/main-consolidation-v1/artifact-hashes.sha256`

The consolidation restored 50 detached `.omo` receipts to their original local paths and archived 63 retained files byte-for-byte. Ten of thirteen Task-26 counterparts matched. Three divergent streams were preserved separately without overwriting canonical evidence.

## Why certification is blocked

- The production Next.js artifact is incomplete; `.next/prerender-manifest.json` is absent.
- Required runtime environment values and authenticated provider proof are unavailable.
- 126 PII-shaped detections remain unexplained: 124 email-shaped and 2 phone-shaped.
- Authority reconciliation still has 2 missing and 3 invalid-subject authorities, with 0 complete hosted receipt sets.
- Pre-QA worktree equivalence and universal cleanup remain unproven.
- F2 and F3 failed; F4 rejected unconditional acceptance; five global review/runtime lanes fail.

## Successor handoff prompt

Use the full `HANDOFF_PROMPT.md` referenced above. In summary:

> Start a new successor remediation and certification run from a fresh task-owned worktree based on `main`. Read the plan, ledger, final recheck, blocked audit, and consolidation package first. Preserve the evaluated candidate and all historical evidence. Resolve the incomplete production build, missing environment and provider authority, unexplained PII-shaped detections, typed-subject gaps, authenticated browser/DB/provider proof, and worktree-preservation gaps. Fix validated defects on a successor commit, then rerun F1-F4, all five review-work lanes, and the debugging runtime audit at the exact successor SHA. Do not claim the current candidate is certified and do not perform production writes or paid/provider actions without exact approval.

## Viewing hidden evidence

From the repository root:

```bash
ls -la .omo
open .omo/evidence/whole-repo-qa/f9be041a9185f7cf3f2ee4518f397f876f090d96-20260809T151939Z/handoff/main-consolidation-v1
```

In Finder, press `Command-Shift-.` to toggle hidden files.
