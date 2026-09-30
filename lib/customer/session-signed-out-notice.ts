/**
 * The notice /home/login shows after "Log out on all devices" could sign out
 * only this browser (`clearAllCustomerSessions` returned `this_device`, and the
 * action redirected with `?signed_out=this_device`).
 */
export const SIGNED_OUT_THIS_DEVICE_NOTICE =
  "You are signed out on this device. Other devices could not be signed out just now. Try again later."

/** Only the exact single value `this_device` shows the notice. */
export function signedOutNotice(
  value: string | string[] | undefined
): string | null {
  return value === "this_device" ? SIGNED_OUT_THIS_DEVICE_NOTICE : null
}
