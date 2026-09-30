/**
 * The notice /home/login shows after "Log out on all devices" could sign out
 * only this browser (`clearAllCustomerSessions` returned `this_device`, and the
 * action redirected with `?signed_out=this_device`).
 */
export const SIGNED_OUT_THIS_DEVICE_NOTICE =
  "You're signed out on this device. We couldn't sign you out on your other devices just now. Sign in and try again later."

/** Only the exact single value `this_device` shows the notice. */
export function signedOutNotice(
  value: string | string[] | undefined
): string | null {
  return value === "this_device" ? SIGNED_OUT_THIS_DEVICE_NOTICE : null
}
