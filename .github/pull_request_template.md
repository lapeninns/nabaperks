<!-- Keep PRs small and tied to a Micro-Spec where one exists. -->

## What & why

<!-- The end state this change reaches, and the reason. Link the Micro-Spec or issue. -->

Closes #

## Governance

- Spec ID:
- Risk class:
- Requirement IDs:
- Blast radius:
- Micro-Spec outcome and scope:
- Browser evidence: required / not required because this is governance-only or non-runtime work

## How it was built (TDD)

<!-- Red → Green → Refactor. Which EARS requirements got a failing test first? -->

## Verification

- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test` (and `pnpm test:coverage` if touching `lib/`)
- [ ] `pnpm governance`
- [ ] `pnpm quality` (naming, debt, N+1, AGENTS.md, complexity, routes, dead/dup code)
- [ ] `pnpm build`
- [ ] Relevant `supabase/tests` SQL or Playwright smoke, if the surface changed

## Product & design guardrails

- [ ] No retired naming (stamp-code, shared-PIN, phone handover, legacy product names)
- [ ] Copy is plain, warm, British (en-GB); no emoji, no exclamation marks
- [ ] No new shared staff secrets; loyalty mutations still go through the RPCs
- [ ] Blast radius matches the Micro-Spec; no out-of-scope behaviour added

## Notes for reviewers

<!-- Screenshots for UI, migration/rollout notes, or anything non-obvious. -->
