# Plan 002: CI restores the Next.js build cache so `pnpm build` isn't cold every run

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan in
> `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 4a04c141..HEAD -- .github`
> If any workflow/action file changed since this plan was written, compare the
> "Current state" excerpts against the live files before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `4a04c141`, 2026-07-03

## Why this matters

`pnpm build` runs in three separate CI jobs on every push/PR (`build`,
`lighthouse`, `zap-baseline`), and the composite setup action caches only the
pnpm store — never `.next/cache`. Next.js keeps its incremental compiler cache
(webpack module cache + type cache) under `.next/cache`; discarding it forces a
full cold compile three times per CI run. Restoring it is the single cheapest CI
wall-clock / Actions-minutes win available here. It is additive and safe: a
stale or missing cache simply falls back to a cold build.

## Current state

- `.github/actions/setup/action.yml` — composite setup used by every job:
  ```yaml
  # .github/actions/setup/action.yml
  runs:
    using: composite
    steps:
      - name: Install pnpm
        uses: pnpm/action-setup@v4
      - name: Install Node.js
        uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: pnpm            # <-- only the pnpm store is cached
      - name: Install dependencies
        shell: bash
        run: pnpm install --frozen-lockfile
  ```
- `.github/workflows/ci.yml` runs `pnpm build` in three jobs: `build`
  (`- run: pnpm build`, ~line 50), `lighthouse` (`- run: pnpm build`, ~line 186),
  and `zap-baseline` (`- run: pnpm build`, ~line 217). None of them restore
  `.next/cache`.
- Confirm nothing already caches it: `grep -rn "next/cache\|restore-keys" .github`
  returns **no** `.next/cache` entry.

Repo conventions: CI uses `actions/checkout@v7`, `actions/setup-node@v4`,
`actions/upload-artifact@v4`, and the local composite `./.github/actions/setup`.
Match those action major versions.

## Commands you will need

CI YAML cannot be "run" locally to prove the cache hit. Validate structurally:

| Purpose            | Command                                              | Expected |
|--------------------|-----------------------------------------------------|----------|
| YAML sanity        | `python3 -c "import yaml,sys; yaml.safe_load(open('.github/actions/setup/action.yml'))"` | exit 0 (no parse error) |
| Local build still works | `pnpm build`                                   | exit 0 (unchanged behavior) |
| Grep the new cache step | `grep -rn "actions/cache" .github`             | at least one match |

(If `python3`/`yaml` is unavailable, skip the YAML sanity command and rely on a
careful diff review — do not add other tooling.)

## Suggested executor toolkit

- If a `github-actions` or CI-configuration skill is available, use it to
  confirm the cache key/paths follow current `actions/cache@v4` conventions.
- Reference: the Next.js "Continuous Integration (CI) Build Caching" doc
  describes the exact `.next/cache` key pattern reproduced below.

## Scope

**In scope** (choose ONE placement — see Step 1):
- `.github/actions/setup/action.yml` (preferred — caches once for all jobs), OR
- `.github/workflows/ci.yml` (add a cache step before each `pnpm build`).

**Out of scope** (do NOT touch):
- Any job's build/test/lint commands or env blocks.
- The pnpm-store cache (`cache: pnpm`) — leave it.
- `next.config.ts` and application code.

## Git workflow

- Branch: `advisor/002-ci-next-build-cache`
- Commit message: `ci: cache .next/cache to avoid cold Next builds`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add a `.next/cache` restore/save step in the composite setup

Preferred placement is the composite action so all three build jobs benefit from
one cache. Add this step to `.github/actions/setup/action.yml` **after** the
"Install dependencies" step:

```yaml
    - name: Restore Next.js build cache
      uses: actions/cache@v4
      with:
        path: ${{ github.workspace }}/.next/cache
        # Bust the cache when deps or source change; fall back to the latest
        # cache for the same lockfile otherwise.
        key: ${{ runner.os }}-nextjs-${{ hashFiles('pnpm-lock.yaml') }}-${{ hashFiles('**/*.[jt]s', '**/*.[jt]sx') }}
        restore-keys: |
          ${{ runner.os }}-nextjs-${{ hashFiles('pnpm-lock.yaml') }}-
```

Notes for the executor:
- Keep it a `composite` step (`uses:` is allowed in composite actions).
- Do not remove or reorder the existing pnpm/node/install steps.

**Verify**:
- `grep -rn "actions/cache@v4" .github/actions/setup/action.yml` → one match.
- YAML sanity command (above) → exit 0.

### Step 2: Confirm the app still builds locally

The cache step is CI-only and must not change build output. Run a local build to
prove the surrounding files are still valid.

**Verify**: `pnpm build` → exit 0.

## Test plan

- There is no unit test for CI YAML. Verification is: (a) YAML parses, (b) the
  cache step is present with the documented key, (c) `pnpm build` still exits 0
  locally.
- Post-merge confirmation (operator, not executor): the second CI run after this
  lands should show a `.next/cache` cache **hit** and a shorter build step; note
  this in the PR description if you open one.

## Done criteria

ALL must hold:

- [ ] A single `actions/cache@v4` step caches `.next/cache` in the composite
      setup (or before each `pnpm build` if the workflow placement was chosen)
- [ ] The cache `key` includes `hashFiles('pnpm-lock.yaml')` and source hashes,
      with a lockfile-only `restore-keys` fallback
- [ ] `.github/actions/setup/action.yml` still parses as YAML
- [ ] `pnpm build` exits 0 locally
- [ ] The existing `cache: pnpm` line is untouched
- [ ] No files outside `.github/` are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- The composite setup no longer matches the "Current state" excerpt (someone
  already changed caching).
- `pnpm build` fails locally **before** your change (pre-existing breakage — not
  yours to fix here; report it).
- You cannot determine the workspace path convention used by other steps
  (`${{ github.workspace }}` vs a relative path) — match whatever the repo's
  other `path:` usages do.

## Maintenance notes

- If the repo migrates fully to Turbopack builds, revisit the cache path — the
  Turbopack cache location may differ from webpack's `.next/cache`.
- Reviewer should check the cache `key` isn't so coarse it never busts (it hashes
  source) nor so fine it never hits (the `restore-keys` fallback handles that).
- Deferred (optional follow-up, not this plan): build once in the `build` job and
  share the compiled `.next` as an artifact with the `lighthouse`/`zap` jobs to
  avoid rebuilding at all. That is a larger workflow refactor.
