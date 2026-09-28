/**
 * How a signed-in customer can sign back in to this wallet, in the words the
 * profile uses ("Sign back in with …"). Pure, so it unit-tests directly.
 *
 * A phone always signs in. A verified email signs in only while email sign-in
 * is on (`existing` or `full`). A wallet with no phone was started with its
 * email, which can only happen with email sign-in on; the runbook forbids
 * turning it off once such wallets exist, so its email is named regardless.
 */
export function customerSignInMethodsLabel({
  hasPhone,
  hasVerifiedEmail,
  emailSignInEnabled,
}: {
  readonly hasPhone: boolean
  readonly hasVerifiedEmail: boolean
  readonly emailSignInEnabled: boolean
}): string {
  if (!hasPhone) return "your email"
  return hasVerifiedEmail && emailSignInEnabled
    ? "your phone number or email"
    : "your phone number"
}
