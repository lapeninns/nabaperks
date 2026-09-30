import Link from "next/link"

import { resetCustomerSessionAction } from "@/app/home/session/reset/actions"
import { Button } from "@/components/ui/button"
import { OPEN_MY_CARDS_LABEL } from "@/lib/copy/product-copy"
import {
  walletLinkReturnTo,
  type WalletLinkRecovery,
} from "@/lib/customer/previous-stamps"

/**
 * The one action after a previous-stamps attempt. "Sign in again" returns the
 * guest to where they were (`returnTo`, for example the reward they were
 * setting up), validated as a same-origin path and again by the reset action;
 * it defaults to the profile. A card that was brought together, or one that
 * needs staff to look at it, offers the guest's cards.
 */
export function WalletLinkNextStep({
  linked,
  recovery,
  returnTo,
}: {
  linked?: boolean
  recovery?: WalletLinkRecovery
  returnTo?: string
}) {
  if (recovery === "reauthenticate") {
    return (
      <form action={resetCustomerSessionAction}>
        <input type="hidden" name="next" value={walletLinkReturnTo(returnTo)} />
        <Button type="submit" variant="secondary">
          Sign in again
        </Button>
      </form>
    )
  }
  if (!linked && recovery !== "requires_review") return null
  return (
    <Button asChild variant="secondary">
      <Link href="/home">{OPEN_MY_CARDS_LABEL}</Link>
    </Button>
  )
}
