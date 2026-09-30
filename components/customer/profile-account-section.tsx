import { SectionHeader } from "@/components/brand"
import { Button } from "@/components/ui/button"

/**
 * The sign-out area at the foot of the Profile screen. Sign-out used to sit in
 * the customer shell's sticky header on every screen, competing with each
 * screen's own task; it belongs with the other account facts, and the fixed
 * tab bar keeps Profile, and so signing out, two taps from anywhere.
 *
 * The action itself is unchanged: the caller passes the same
 * `signOutCustomerAction` server action, still submitted from a plain form, so
 * session clearing stays server-side. Sessions no longer lapse on their own,
 * so `signOutAllAction` is the customer's remedy for a lost or shared phone:
 * it revokes every session on the account, not just this browser's.
 *
 * `signInWith` names how this card signs back in. Phone is the only way in,
 * so it is passed only for a card with a confirmed mobile number; a card
 * without one is asked to add it in the Contact section, which says why,
 * instead of this section describing a rollout setting (the old "email
 * sign-in is paused" warning).
 */
export function CustomerProfileAccountSection({
  memberSinceLabel,
  venueLabel,
  signInWith,
  signOutAction,
  signOutAllAction,
}: {
  memberSinceLabel: string
  venueLabel: string
  signInWith?: string
  signOutAction: React.ComponentProps<"form">["action"]
  signOutAllAction: React.ComponentProps<"form">["action"]
}) {
  return (
    <section className="surface-card grid gap-4 p-5" data-account-section>
      <SectionHeader eyebrow="Account" title="Sign out" />

      <p className="mono-id tracking-[0.08em] text-muted-foreground">
        Member since {memberSinceLabel} · {venueLabel}
      </p>

      <p className="text-sm leading-6 text-muted-foreground">
        You stay signed in on this device until you sign out. Your cards, stamps
        and rewards stay with you.
        {signInWith ? ` Sign back in with ${signInWith}.` : null}
      </p>

      <form action={signOutAction}>
        {/* Default size keeps the account action on the 44px tap contract
            (CUS-P2-14). */}
        <Button type="submit" variant="secondary" className="w-full">
          Sign out
        </Button>
      </form>

      <p className="text-sm leading-6 text-muted-foreground">
        Lost a phone, or signed in on someone else&apos;s? Sign out everywhere
        you are signed in.
      </p>

      <form action={signOutAllAction}>
        <Button type="submit" variant="outline" className="w-full">
          Sign out on all devices
        </Button>
      </form>
    </section>
  )
}
