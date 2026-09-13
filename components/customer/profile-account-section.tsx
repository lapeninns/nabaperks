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
 * session clearing stays server-side.
 */
export function CustomerProfileAccountSection({
  memberSinceLabel,
  venueLabel,
  signOutAction,
}: {
  memberSinceLabel: string
  venueLabel: string
  signOutAction: React.ComponentProps<"form">["action"]
}) {
  return (
    <section className="surface-card grid gap-4 p-5" data-account-section>
      <SectionHeader eyebrow="Account" title="Your account" />

      <p className="mono-id tracking-[0.08em] text-muted-foreground">
        Member since {memberSinceLabel} · {venueLabel}
      </p>

      <p className="text-sm leading-6 text-muted-foreground">
        Logging out signs this device out only. Your cards, stamps and rewards
        stay on your account — sign back in with your phone number.
      </p>

      <form action={signOutAction}>
        {/* Default size keeps the account action on the 44px tap contract
            (CUS-P2-14). */}
        <Button type="submit" variant="secondary" className="w-full">
          Log out
        </Button>
      </form>
    </section>
  )
}
