/**
 * Pure source for the customer error-boundary retry button's label + disabled
 * state. The boundary runs `reset()` inside a React transition; while that
 * transition is pending the button must read as busy (and block re-taps) rather
 * than silently re-firing a retry that may fail again with no feedback (F16).
 */
export type RetryButtonState = {
  label: string
  disabled: boolean
}

export function retryButtonState(isPending: boolean): RetryButtonState {
  return isPending
    ? { label: "Trying again", disabled: true }
    : { label: "Try again", disabled: false }
}
