import * as React from "react"

const MOBILE_BREAKPOINT = 768
const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

export function useIsMobile() {
  return React.useSyncExternalStore(
    subscribeToMobileQuery,
    readMobileSnapshot,
    readServerMobileSnapshot
  )
}

function subscribeToMobileQuery(onStoreChange: () => void) {
  const mediaQueryList = window.matchMedia(MOBILE_QUERY)
  mediaQueryList.addEventListener("change", onStoreChange)

  return () => mediaQueryList.removeEventListener("change", onStoreChange)
}

function readMobileSnapshot() {
  return window.matchMedia(MOBILE_QUERY).matches
}

function readServerMobileSnapshot() {
  return false
}
