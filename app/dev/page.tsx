import Link from "next/link"
import { notFound } from "next/navigation"

import { Eyebrow, PageTitle, SectionHeader } from "@/components/brand"

export const dynamic = "force-dynamic"

/**
 * The /dev index. Every harness lane already existed but nothing linked to
 * them: `/dev` and `/dev/app-harness` both 404'd, so a developer had to read
 * the file tree to discover the lanes, and the two screenshot query params
 * (`?w=` on the /dev layout, `?sidebar=collapsed` on the app harness) were
 * documented nowhere in the product.
 */
const DEV_GROUPS = [
  {
    label: "Catalogue",
    description: "The acceptance gate for the foundation layer.",
    links: [{ href: "/dev/design-system", label: "Design system" }],
  },
  {
    label: "Merchant app harness",
    description:
      "Signed-out fixtures of the authenticated merchant console surfaces.",
    links: [
      { href: "/dev/app-harness", label: "All lanes" },
      { href: "/dev/app-harness/dashboard", label: "Dashboard" },
      { href: "/dev/app-harness/launch", label: "Launch / setup" },
      { href: "/dev/app-harness/customers", label: "Members" },
      { href: "/dev/app-harness/activity", label: "Activity" },
      { href: "/dev/app-harness/offers", label: "Offers" },
      { href: "/dev/app-harness/announcements", label: "Announcements" },
      { href: "/dev/app-harness/account", label: "Account and billing" },
      { href: "/dev/app-harness/qr", label: "Poster / QR" },
      { href: "/dev/app-harness/scan", label: "Counter scan" },
      { href: "/dev/app-harness/reward-scan", label: "Reward scan" },
      { href: "/dev/app-harness/send-reward", label: "Send a reward" },
      { href: "/dev/app-harness/invite", label: "Invite" },
      { href: "/dev/app-harness/onboarding", label: "Onboarding" },
      { href: "/dev/app-harness/pilot-note", label: "Pilot note" },
      { href: "/dev/app-harness/trial", label: "Trial" },
      { href: "/dev/app-harness/trial/admin", label: "Trial — admin view" },
      { href: "/dev/app-harness/skeletons", label: "Loading skeletons" },
      { href: "/dev/app-harness/states", label: "Empty / error states" },
    ],
  },
  {
    label: "Customer home harness",
    description: "Signed-out fixtures of the customer surfaces.",
    links: [
      { href: "/dev/home-harness/home", label: "Home" },
      { href: "/dev/home-harness/stamp", label: "Stamp" },
      { href: "/dev/home-harness/rewards", label: "Rewards" },
      { href: "/dev/home-harness/gift-chip", label: "Gift chip" },
      { href: "/dev/home-harness/referral-bank", label: "Referral bank" },
      {
        href: "/dev/home-harness/redemption-second-factor",
        label: "Redemption second factor",
      },
    ],
  },
  {
    label: "Print previews",
    description: "Poster, tent and NFC artwork proofs.",
    links: [
      { href: "/dev/poster-preview", label: "Poster preview" },
      { href: "/dev/tent-preview", label: "Table tent preview" },
      { href: "/dev/nfc-card-preview", label: "NFC card preview" },
      { href: "/dev/nfc-square-preview", label: "NFC square preview" },
    ],
  },
] as const

export default function DevIndexPage() {
  if (process.env.NODE_ENV === "production") notFound()

  return (
    <main className="mx-auto grid w-full max-w-merchant gap-6 px-6 py-10">
      <PageTitle
        eyebrow="Developer surfaces"
        title="Dev harness index"
        description="Every non-product surface in one place: the design-system catalogue, the signed-out fixtures used for screenshot proof, and the print previews."
      />

      <section className="surface-card grid gap-3 p-5">
        <SectionHeader
          title="Screenshot query params"
          description="Both apply to any /dev route and neither was documented anywhere in the product."
        />
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div className="grid gap-1">
            <dt className="eyebrow">?w=&lt;px&gt;</dt>
            <dd className="text-muted-foreground">
              Pins the render to an exact CSS pixel width (240–3840) so a
              headless screenshot captures a chosen breakpoint regardless of
              window size.
            </dd>
          </div>
          <div className="grid gap-1">
            <dt className="eyebrow">?sidebar=collapsed</dt>
            <dd className="text-muted-foreground">
              Starts the app-harness console with the sidebar rail collapsed.
            </dd>
          </div>
        </dl>
      </section>

      {DEV_GROUPS.map((group) => (
        <section key={group.label} className="surface-card grid gap-3 p-5">
          <SectionHeader title={group.label} description={group.description} />
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {group.links.map((link) => (
              <li key={link.href} className="min-w-0">
                <Link
                  href={link.href}
                  className="focus-ring surface-card-flat grid min-h-11 min-w-0 content-center gap-1 px-3 py-2 hover:bg-secondary"
                >
                  <span className="truncate font-bold">{link.label}</span>
                  <Eyebrow className="truncate normal-case">
                    {link.href}
                  </Eyebrow>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  )
}
