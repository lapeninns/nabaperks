import type { ReactNode } from "react"

import { SectionHeader } from "@/components/brand"
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
 */
export function CustomerProfileAccountSection({
  memberSinceLabel,
  venueLabel,
  signInWith = "your phone number",
  addPhone,
  signOutAction,
  signOutAllAction,
}: {
  memberSinceLabel: string
  venueLabel: string
  signInWith?: string
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
        and rewards stay on your account. Sign back in with {signInWith}.
      </p>

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
