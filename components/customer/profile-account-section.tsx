import type { ReactNode } from "react"

import { SectionHeader } from "@/components/brand"
import { StatusBanner } from "@/components/loyalty"
import { Button } from "@/components/ui/button"

/**
 * The account area on the Profile screen. Sign-out used to sit in the customer
 * shell's sticky header on every screen, competing with each screen's own task;
 * it belongs with the other account facts, and the fixed tab bar keeps Profile —
 * and so signing out — two taps from anywhere.
 *
 * The action itself is unchanged: the caller passes the same
 * `signOutCustomerAction` server action, still submitted from a plain form, so
 * session clearing stays server-side. Sessions no longer lapse on their own,
 * so `signOutAllAction` is the customer's remedy for a lost or shared phone:
 * it revokes every session on the account, not just this browser's.
 *
 * `signInWith` names the ways this wallet can sign back in, worked out on the
 * server from the contacts it holds and the email sign-in mode. `addPhone` is
 * the "add a phone number" form, passed only for a wallet with no phone.
 *
 * `emailSignInPaused` is set on the server for a wallet with no verified phone
 * while email sign-in is off: it has no way back in once logged out, so the
 * section warns before both log-out controls and points to adding a phone
 * instead of naming a sign-in route that is closed (QA BUG-022).
 */
export function CustomerProfileAccountSection({
  memberSinceLabel,
  venueLabel,
  signInWith = "your phone number",
  emailSignInPaused = false,
  addPhone,
  signOutAction,
  signOutAllAction,
}: {
  memberSinceLabel: string
  venueLabel: string
  signInWith?: string
  emailSignInPaused?: boolean
  addPhone?: ReactNode
  signOutAction: React.ComponentProps<"form">["action"]
  signOutAllAction: React.ComponentProps<"form">["action"]
}) {
  return (
    <section className="surface-card grid gap-4 p-5" data-account-section>
      <SectionHeader eyebrow="Account" title="Your account" />

      <p className="mono-id tracking-[0.08em] text-muted-foreground">
        Member since {memberSinceLabel} · {venueLabel}
      </p>

      <p className="text-sm leading-6 text-muted-foreground">
        You stay signed in on this device until you log out. Your cards, stamps
        and rewards stay on your account.
        {emailSignInPaused ? null : ` Sign back in with ${signInWith}.`}
      </p>

      {emailSignInPaused ? (
        <StatusBanner
          tone="warning"
          title="Add a phone number before you log out"
        >
          Email sign-in is paused, so you could not sign back in to this account
          after logging out. Add a phone number in Your contact details above,
          then you can sign in with it.
        </StatusBanner>
      ) : null}

      {addPhone}

      <form action={signOutAction}>
        {/* Default size keeps the account action on the 44px tap contract
            (CUS-P2-14). */}
        <Button type="submit" variant="secondary" className="w-full">
          Log out
        </Button>
      </form>

      <p className="text-sm leading-6 text-muted-foreground">
        Lost a phone, or signed in on someone else&apos;s? Log out everywhere
        your account is signed in.
      </p>

      <form action={signOutAllAction}>
        <Button type="submit" variant="outline" className="w-full">
          Log out on all devices
        </Button>
      </form>
    </section>
  )
}
