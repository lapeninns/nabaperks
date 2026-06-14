# Clean the Nabaperks repo

## Context

The **source code is already clean** — `pnpm lint`, `pnpm typecheck`, and all **139 Vitest tests** pass; there are no TODO/FIXME markers, no `any`/`@ts-ignore`, and no `.bak`/`.old` files. The actual mess is the **git working tree**: a large, uncommitted redesign is sitting unstaged alongside ignorable cruft and `.gitignore` gaps, so `git status` shows **56 modified + 7 deleted + 252 untracked** entries — a mix of real new work and noise that should never be tracked.

Goal (per your choices): **working-tree hygiene + commit the redesign in logical groups + prune genuinely-dead source**, while **gitignoring (not deleting)** the reference dirs your memory flags as active.

### Key corrections to the raw findings
- The "orphaned" UI primitives `components/ui/{skeleton,spinner,tabs,input-group}.tsx` are intentional **shadcn design-system primitives** (memory: *"shadcn primitives stay untouched"*). **Keep them.**
- `.tmp/` is **not junk**: `proto-v3` is the binding prototype toolchain and `redesign-specs.json` is the active redesign spec. **Gitignore, keep on disk.**
- `supabase/.temp/` contains connection secrets (`pooler-url`, `linked-project.json`, `project-ref`). **Must be gitignored — never committed.**

---

## Step 0 — Baseline (safety)

Confirm the green starting point before changing anything:
```
pnpm lint && pnpm typecheck && pnpm test
```
Expect: 0 lint/type errors, 139 tests passing.

---

## Step 1 — `.gitignore` hygiene  (commit: `chore: ignore local tooling and temp dirs`)

`.gitignore` already ignores `.DS_Store`, `.env*` (except `.env.example`), `/.next/`, `/build`, `*.tsbuildinfo`. **Add** the missing entries:
- `.tmp/`
- `.claude/`
- `.firecrawl/`
- `supabase/.temp/`   ← prevents committing pooler/project secrets

Then remove on-disk cruft (already ignored, just tidying the working dir — not history):
```
find . -name .DS_Store -not -path './node_modules/*' -delete   # 8 files incl. supabase/.DS_Store
rm -rf .next/dev/logs                                           # stray dev log
```
Commit only `.gitignore`. After this, the `.tmp/`, `.claude/`, `.firecrawl/`, `supabase/.temp/` noise disappears from `git status`.

Critical file: [.gitignore](.gitignore)

---

## Step 2 — Prune dead source (working tree, before staging)

All three are **untracked new files**, so "pruning" = remove them before they ever enter history (no separate commit needed; the edit to the motion barrel rides along with the components commit):

| Target | Why dead | Action |
|---|---|---|
| `lib/supabase/client.ts` | `createSupabaseBrowserClient` has **zero** references; `lib/supabase/server.ts` is the one used | `rm` |
| `components/motion/dashboard-metric-grid.tsx` | `DashboardMetricGrid` used only by its own barrel + a frozen docs artifact; no app usage | `rm` + drop its 2 export lines from [components/motion/index.ts](components/motion/index.ts) |
| `app/api/cron/` (empty dir) | empty; `vercel.json` is `{}` so no cron is wired | `rmdir` |

**Keep** (not dead): shadcn primitives, empty `hooks/` + `public/` `.gitkeep` placeholders (conventional, low value to remove).

Re-run `pnpm lint && pnpm typecheck && pnpm test` to confirm the prune broke nothing.

---

## Step 3 — Commit the redesign in logical groups

The changes are **interdependent**, so intermediate commits are not guaranteed to each build in isolation — the groups exist for **readable history**, and the green guarantee is verified at the **final HEAD** (Step 4). Stage by explicit paths so `supabase/.temp/` and ignored dirs are never picked up. Suggested order and grouping:

1. **`chore: project tooling & config`**
   `package.json` · `tsconfig.json` · `next.config.ts` · `eslint.config.mjs` · `.prettierrc` (if changed) · `vitest.config.ts` · `vercel.json` · `.env.example` · `config/env-contract.json` · `scripts/*.mjs`

2. **`feat: domain libs & supabase backend`**
   `lib/**` (auth, analytics, security, stripe, supabase[server], staff, env, customer, merchant, admin, qr) · `supabase/migrations/**`, `supabase/*.sql`, `supabase/README.md`, `supabase/tests/**` — **exclude `supabase/.temp/`**

3. **`feat: component redesign`**
   `components/**` — includes the deletions (`customer/reward-redemption-form.tsx`, `merchant/staff-pin-settings-form.tsx`, `staff/staff-pin-form.tsx`) and the pruned `components/motion/index.ts` edit

4. **`feat: route redesign & consolidation`**
   `app/**` — modified pages/actions, new routes (`app/app/launch`, `app/staff`, `app/api/stripe`, `app/api/tokens`, `app/card/[membershipId]/stamp`, `app/app/qr/preview`), and the deleted routes (`app/app/card/page.tsx`, `app/app/qr/page.tsx`, `app/reward/[rewardId]/actions.ts`, `app/staff/stamp/actions.ts`)

5. **`test: redesign micro-specs`**
   `tests/**` — modified specs + new specs (`counter-handshake`, `design-system-import`, `merchant-launch-readiness`, `merchant-qr-mutations`, `staff-billing-admin`) + `tests/helpers/server-only.ts`

6. **`docs: refresh specs and guides`**
   `README.md` · `AGENTS.md` · `DESIGN.md` (a passing test reads it) · `Instructions_tdd.md` · `Instructions_MircroSpecsCreation.md` · `nabaperks-micro-specs-final.md` · `docs/**` (note: `docs/` is ~1.1 MB, includes the Honey & Ink design-system mirror the tests assert on, plus the frozen `merchant-app-frontend-consolidated.tsx` reference)

Use the project commit-message convention (lowercase `type: subject`, matching recent history like `feat: refresh QR asset visuals`).

---

## Open decision (flagged, not assumed)

- **`Plan.md`** (untracked, root) looks like scratch planning. Default: **leave untracked** (or add to `.gitignore`). I will not commit it unless you say otherwise.

---

## Step 4 — Verify

At the final HEAD:
```
pnpm lint && pnpm typecheck && pnpm test
git status          # should be clean except intentionally-ignored/untracked (.tmp/, Plan.md, etc.)
git log --oneline -7
```
Pass criteria: lint/type clean, **139 tests green**, no secrets in history (`git log -p -- supabase/.temp` returns nothing), working tree clean.

---

## Explicitly NOT doing
- Not deleting `.tmp/`, `.firecrawl/`, `.claude/` (gitignored, kept on disk).
- Not deleting shadcn UI primitives (`skeleton`/`spinner`/`tabs`/`input-group`).
- Not committing `supabase/.temp/`, `.env*` (except `.env.example`), or `Plan.md`.
- Not introducing new tooling (knip/ts-prune/depcheck) — not needed; existing lint/typecheck/tests are the quality gate.
- No behavior changes — the v3 counter-handshake behavior and route redirects stay exactly as-is.
