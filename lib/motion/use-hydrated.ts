import { useSyncExternalStore } from "react"

const subscribe = () => () => {}

/**
 * True only after client hydration (false during SSR). Lets the Wet Ink motion
 * primitives render static children on the server and start animating on the
 * client — without a setState-in-effect mount flag (react-hooks/set-state-in-
 * effect). Mirrors the pattern used in components/customer/home-birthday-prompt.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  )
}
