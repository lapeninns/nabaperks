# Plan 015: Fix the stale-closure race in the push-preference toggles

> **Executor instructions**: Follow step by step; run every verification command.
> If a "STOP condition" occurs, stop and report. Update this plan's row in
> `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat 4a04c141..HEAD -- components/customer/push-notification-settings.tsx`

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `4a04c141`, 2026-07-03

## Why this matters

The push-notification preference toggles update React state optimistically, but
on failure they restore a **render-time closure snapshot** of the whole
preferences object, and on success they overwrite the whole object with the
server echo. If a user flips two preference rows in quick succession and one
request fails (or the two responses race), the failed/returning handler can
revert or resurrect the *other* row's change, so the UI and persisted server
state silently disagree until reload. The blast radius is small (three booleans),
but the fix is trivial and removes a real correctness footgun.

## Current state

```ts
// components/customer/push-notification-settings.tsx:199-220
async function updatePreference(key, value) {
  const next = { ...preferences, [key]: value }   // reads closure `preferences`
  setPreferences(next)                             // optimistic
  setMessage(null)
  const response = await fetch("/api/notifications/push/preferences", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(next),
  })
  if (!response.ok) {
    setPreferences(preferences)                    // BUG: restores stale snapshot
    setMessage("Preference was not saved.")
    return
  }
  const body = (await response.json().catch(() => null)) as { preferences?: PushPreferences } | null
  if (body?.preferences) setPreferences(body.preferences)  // clobbers a concurrent toggle
}
```
- The `<input onChange>` at `:287` calls `updatePreference(key, value)` per toggle.
- `setPreferences` is a `useState` setter (functional-updater form is available).

## Commands you will need

| Purpose    | Command          | Expected |
|------------|------------------|----------|
| Typecheck  | `pnpm typecheck` | exit 0   |
| Lint       | `pnpm lint`      | exit 0   |
| Build      | `pnpm build`     | exit 0   |
| a11y/e2e (if a harness case exists) | `pnpm test:e2e -- --grep "push"` | pass or n/a |

## Scope

**In scope**:
- `components/customer/push-notification-settings.tsx` (the `updatePreference`
  handler and, if you choose the in-flight-guard approach, the input `disabled`
  state).

**Out of scope**:
- `/api/notifications/push/preferences` route (server side is fine).
- The rest of the component's layout/copy.

## Git workflow

- Branch: `advisor/015-preference-toggle-race`
- Commit: `fix(customer): avoid clobbering concurrent push-preference toggles`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Use functional updaters and restore only the toggled key

Rewrite `updatePreference` so it never reads or restores the whole closure
snapshot:

```ts
async function updatePreference(key, value) {
  setMessage(null)
  setPreferences((prev) => ({ ...prev, [key]: value }))        // optimistic, latest state
  const response = await fetch("/api/notifications/push/preferences", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ [key]: value }),  // or the full object if the route requires it
  })
  if (!response.ok) {
    setPreferences((prev) => ({ ...prev, [key]: !value }))     // revert ONLY this key
    setMessage("Preference was not saved.")
    return
  }
  const body = (await response.json().catch(() => null)) as { preferences?: PushPreferences } | null
  if (body?.preferences) {
    // Merge the authoritative value for THIS key only, so a concurrent toggle
    // isn't clobbered by a full-object overwrite.
    const confirmed = body.preferences
    setPreferences((prev) => ({ ...prev, [key]: confirmed[key] }))
  }
}
```

First check what the route expects as the request body: if it requires the full
preferences object (not a partial), keep sending the full object but build it
from the latest state inside a functional updater rather than the stale closure.
Read `app/api/notifications/push/preferences/route.ts` to confirm the contract
before choosing partial vs full body.

Optionally, additionally disable the specific input while its request is in
flight (an `in-flight` set keyed by `key`) to prevent overlap entirely — this is
the most robust option if the route needs the full object.

**Verify**:
- `pnpm typecheck && pnpm lint && pnpm build` → all exit 0.
- Manual: toggle two rows rapidly; both persist; reload shows the same state.

## Test plan

- If a Playwright harness page mounts this component, add/extend a case toggling
  two rows and asserting both persist. Otherwise, manual verification (the
  component needs a push subscription context that is awkward to unit-test).
- Verification: typecheck/lint/build pass; manual double-toggle is consistent.

## Done criteria

ALL must hold:

- [ ] `updatePreference` uses functional `setPreferences((prev) => ...)` for the
      optimistic set AND the failure revert (no whole-closure `setPreferences(preferences)`)
- [ ] On success, only the toggled key is reconciled from the server echo (no
      full-object overwrite that could clobber a concurrent toggle) — OR inputs
      are disabled while in flight so overlap is impossible
- [ ] The request body matches the route's contract (confirmed by reading the route)
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm build` pass
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report if:
- The route requires the full preferences object AND server-side merging is not
  per-key (then the in-flight-guard approach is required — note it).
- `PushPreferences` has non-boolean fields that make a per-key revert ambiguous.

## Maintenance notes

- Reviewer: the anti-pattern to watch for is any `setState(closureSnapshot)` —
  always prefer the functional updater in optimistic handlers.
