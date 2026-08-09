import Link from "next/link"

import { ArrowRight01Icon } from "@hugeicons/core-free-icons"

import { Icon } from "@/components/brand"
import { MerchantProfileForm } from "@/components/merchant/profile-form"

/**
 * The presentational half of the account profile panel.
 *
 * Split out for the same reason `billing-panel-view` was: `ProfilePanel` is an
 * async server component that calls `getMerchantProfile()`, so a harness cannot
 * render it and had to keep a hand-copied duplicate of this markup. That
 * duplicate drifted in exactly the way you would expect — a touch-target fix
 * had to be applied twice, and a sabotage test briefly looked like a broken
 * guard because only one copy had been patched.
 *
 * Both the route and `/dev/app-harness/account` render THIS, so what the
 * harness proves is now a fact about the shipped component.
 * Server component.
 */
export function ProfilePanelView({
  businessName,
  businessType,
  email,
  phone,
  venueAddressDisplay,
}: {
  readonly businessName: string
  readonly businessType: string
  readonly email: string
  readonly phone: string
  /** Formatted single-line address, or empty when none is saved yet. */
  readonly venueAddressDisplay: string
}) {
  return (
    <section className="grid min-w-0 gap-5">
      <section className="surface-card grid min-w-0 gap-3 p-5">
        <p className="eyebrow">What customers see</p>
        <p className="text-2xl leading-tight font-extrabold break-words">
          {businessName}
        </p>
        <p className="text-sm leading-6 text-muted-foreground">
          {venueAddressDisplay ||
            "Add your venue address in Setup so customers can find you."}
        </p>
        <Link
          href="/app/launch?tab=venue"
          className="mt-1 inline-flex min-h-11 w-fit items-center gap-1.5 text-sm font-bold text-ink underline decoration-2 underline-offset-4 transition-colors duration-[var(--w-dur-fast)] ease-[var(--w-ease)] hover:text-primary motion-reduce:transition-none"
        >
          Edit venue details
          <Icon icon={ArrowRight01Icon} size={16} />
        </Link>
      </section>

      <div className="grid gap-3">
        <MerchantProfileForm
          businessName={businessName}
          businessType={businessType}
          email={email}
          phone={phone}
        />
        <p className="text-sm leading-6 text-muted-foreground">
          Address and GPS checks are managed in Setup. Business contact details
          saved here feed customer terms, billing setup, merchant notifications,
          and support; sign-in credentials stay separate.
        </p>
      </div>
    </section>
  )
}
