import { InboxIcon } from "@hugeicons/core-free-icons"

import { Eyebrow, Icon, ReceiptCard } from "@/components/brand"
import { StampDot } from "@/components/loyalty"
import { LOYALTY_INVITE_LINK_TTL_DAYS } from "@/lib/loyalty-invites/constants"

/**
 * A faithful, non-interactive preview of the invitation email a recipient
 * receives — the same receipt surface, venue line, "two stamps to start your
 * card" headline, two welcome stamps and paced-send footer built by
 * {@link buildLoyaltyInviteEmail} and the /invite claim page. It anchors the
 * compose screen: the merchant sees the payoff they are actually sending before
 * they paste a single address. Purely presentational; the stamps are the only
 * things that carry an accessible name (each announces "Welcome stamp").
 */
export function InvitationPreview({ merchantName }: { merchantName: string }) {
  const venue = merchantName.trim() || "Your venue"

  return (
    <section
      aria-label="Preview of the invitation they receive"
      className="grid gap-3"
    >
      <div className="flex items-center gap-2">
        <Icon
          icon={InboxIcon}
          size={14}
          strokeWidth={2.25}
          className="text-muted-foreground"
        />
        <Eyebrow>They receive</Eyebrow>
      </div>

      <ReceiptCard edge padding="md" rotated className="bg-card">
        <p className="eyebrow truncate">{venue}</p>
        <p className="mt-2 text-lg leading-tight font-extrabold text-balance text-foreground">
          Two stamps to start your card
        </p>

        {/* The literal payoff: the two welcome stamps, hand-stamped tilt. */}
        <div
          className="mt-4 flex items-center justify-center gap-4"
          aria-label="Two welcome stamps"
        >
          <span className="w-12 -rotate-6">
            <StampDot earned label="Welcome stamp" venueName={venue} />
          </span>
          <span className="w-12 -rotate-3">
            <StampDot earned label="Welcome stamp" venueName={venue} />
          </span>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          {`${venue} invited you to their loyalty card. Collect two welcome stamps — there's no app to download.`}
        </p>

        {/* Mirrors the email's primary button; decorative, never a focus stop. */}
        <span
          aria-hidden="true"
          className="mt-4 inline-flex items-center rounded-[10px] border-2 border-ink bg-primary px-4 py-2.5 text-sm font-extrabold text-primary-foreground shadow-[3px_3px_0_var(--w-ink)]"
        >
          Collect your two stamps
        </span>

        <p className="mono-meta mt-4 text-muted-foreground">
          Expires in {LOYALTY_INVITE_LINK_TTL_DAYS} days · one-off email
        </p>
      </ReceiptCard>
    </section>
  )
}
