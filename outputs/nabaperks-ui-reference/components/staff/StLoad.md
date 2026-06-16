# StLoad

- **Surface:** staff (counter station)
- **Source module:** [extracted-source/22-staff-counter.jsx](../../extracted-source/22-staff-counter.jsx) (lines 26–31)
- **Export:** none directly — used internally by `StaffSurface` as the `useState` initialiser (`useStateSt(StLoad)`). The localStorage key is re-exported via `window.StaffEntry.lsKey`.
- **Reuse verdict:** 🔒 Prototype-only (reads station state from `localStorage`; a real station would hydrate from the server).

## Visual purpose

Not a visual component — a state hydrator. It loads the persisted staff-station state from `localStorage` so the till tab survives a page reload, falling back to the default `ST_DEF` state when nothing is stored or the stored value is malformed.

## Props / state

| Item        | Type         | Notes                                                                                         |
| ----------- | ------------ | --------------------------------------------------------------------------------------------- |
| _arguments_ | none         | Called as a bare function (also passed by reference to `useStateSt`).                         |
| _return_    | state object | `{ ...ST_DEF, ...raw }` when a stored object with a `mode` exists, otherwise `{ ...ST_DEF }`. |

**State:** none of its own. It reads the module-level `ST_LS` key and the `ST_DEF` default object.

## UX behaviour

- Reads `localStorage.getItem("v3_staff")` and `JSON.parse`s it.
- If the parsed value is truthy and has a `mode` field, it merges it over the defaults (`{ ...ST_DEF, ...raw }`) — so missing fields are backfilled from `ST_DEF`.
- Any parse/read failure is swallowed by `catch (e)` and returns a fresh `{ ...ST_DEF }`.

## Dependencies

- **Shared primitives:** none.
- **CSS variables:** none.
- **Keyframes:** none.
- **localStorage:** reads key `"v3_staff"` (module constant `ST_LS`). _Prototype-ism — persisted till-station state._
- **Globals / window:** none written directly. (`ST_LS` is surfaced through `window.StaffEntry.lsKey` by `StaffSurface`'s export block.)

## Reuse notes

Prototype-only persistence helper. In production the staff station would derive its state from the server (current stamp count, lockout timers, today's PIN), not from a browser `localStorage` blob — `localStorage` here is purely a prototype mock so the demo survives a refresh. The defensive merge-over-defaults pattern (`{ ...ST_DEF, ...raw }`) and the try/catch fallback are sound and could carry over to any client-side cache, but the key itself and the assumption that the station's source of truth is the browser do not.

## Source snippet

```jsx
function StLoad() {
  try {
    const raw = JSON.parse(localStorage.getItem(ST_LS))
    return raw && raw.mode ? { ...ST_DEF, ...raw } : { ...ST_DEF }
  } catch (e) {
    return { ...ST_DEF }
  }
}
```
