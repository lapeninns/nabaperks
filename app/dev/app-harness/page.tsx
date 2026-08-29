import Link from "next/link"
import { notFound } from "next/navigation"

import { Eyebrow, PageTitle, SectionHeader } from "@/components/brand"

export const dynamic = "force-dynamic"

/**
 * Lane index for the merchant app harness. `/dev/app-harness` used to 404, so
 * the only way to discover a lane was to read the file tree — and once inside
 * a lane the real sidebar links out to the authenticated `/app` routes, which
 * ejects the developer into a login redirect. This page is the harness's own
 * home, and every lane links back to it.
 */
const HARNESS_LANES = [
  {
    label: "Console surfaces",
    links: [
      { href: "/dev/app-harness/dashboard", label: "Dashboard" },
      { href: "/dev/app-harness/customers", label: "Members" },
      { href: "/dev/app-harness/activity", label: "Activity" },
      { href: "/dev/app-harness/offers", label: "Offers" },
      { href: "/dev/app-harness/announcements", label: "Announcements" },
      { href: "/dev/app-harness/account", label: "Account and billing" },
      { href: "/dev/app-harness/qr", label: "Poster / QR" },
    ],
  },
  {
    label: "Flows",
    links: [
      {
        href: "/dev/app-harness/onboarding",
        label: "Onboarding (setup shell)",
      },
      { href: "/dev/app-harness/launch", label: "Launch checklist" },
      { href: "/dev/app-harness/scan", label: "Counter scan" },
      { href: "/dev/app-harness/reward-scan", label: "Reward scan" },
      { href: "/dev/app-harness/send-reward", label: "Send a reward" },
      { href: "/dev/app-harness/invite", label: "Invite" },
      { href: "/dev/app-harness/pilot-note", label: "Pilot note" },
      { href: "/dev/app-harness/trial", label: "Trial" },
      { href: "/dev/app-harness/trial/admin", label: "Trial — admin view" },
    ],
  },
  {
    label: "State proofs",
    links: [
      { href: "/dev/app-harness/skeletons", label: "Loading skeletons" },
      { href: "/dev/app-harness/states", label: "Empty and error states" },
    ],
  },
] as const

export default function AppHarnessIndexPage() {
  if (process.env.NODE_ENV === "production") notFound()

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Developer surfaces"
        title="Merchant app harness"
        description="Signed-out fixtures of the authenticated merchant surfaces, rendered inside the real console shell. Append ?w=<px> to pin a breakpoint, ?sidebar=collapsed to start with the rail closed, or ?only=<section-id> on the skeletons and states pages to isolate one section."
      />

      {HARNESS_LANES.map((group) => (
        <section key={group.label} className="surface-card grid gap-3 p-5">
          <SectionHeader title={group.label} />
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

      <p className="text-sm text-muted-foreground">
        The sidebar in this shell is the real merchant nav, so its links point
        at the authenticated <code>/app</code> routes and will bounce you to
        login. Come back here with{" "}
        <Link
          href="/dev/app-harness"
          className="focus-ring rounded-sm font-semibold underline underline-offset-2"
        >
          /dev/app-harness
        </Link>{" "}
        or the full index at{" "}
        <Link
          href="/dev"
          className="focus-ring rounded-sm font-semibold underline underline-offset-2"
        >
          /dev
        </Link>
        .
      </p>
    </div>
  )
}
