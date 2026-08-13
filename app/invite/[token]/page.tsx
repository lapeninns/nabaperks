import Link from "next/link"
import { after } from "next/server"

import { SubmitButton } from "@/components/forms"
import {
  markInviteOpened,
  resolveInviteClaimContext,
} from "@/lib/loyalty-invites/claim-context"

import { startInviteClaimAction } from "./actions"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const metadata = { robots: { index: false, follow: false } }

export default async function InviteClaimPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const context = await resolveInviteClaimContext(token)

  if (context.status === "available") {
    // "Opened" = the link was visited. Recorded after the response so it never
    // blocks or breaks the page render.
    after(() => markInviteOpened(context.claimTokenHash))
  }

  return (
    <main className="mx-auto grid min-h-dvh max-w-md content-center gap-6 p-6 text-ink">
      <div className="rounded-lg border-2 border-ink bg-paper p-6">
        {context.status === "available" ? (
          <InviteAvailable businessName={context.businessName} token={token} />
        ) : (
          <InviteUnavailable expired={context.status === "expired"} />
        )}
      </div>
    </main>
  )
}

function InviteAvailable({
  businessName,
  token,
}: {
  businessName: string | null
  token: string
}) {
  const venue = businessName?.trim() || "A local venue"
  return (
    <>
      {/* `.eyebrow`, not a hand-rolled `font-mono text-xs tracking-wide …
          uppercase`. DESIGN.md · Typography: "Do not hand-roll `font-mono
          text-[0.x rem] tracking-[…] uppercase` strings — reach for one of
          these utilities". `.eyebrow` IS mono-meta plus the muted colour, and
          --muted-foreground already resolves to --w-ink-soft, so the colour is
          unchanged; the tracking moves from Tailwind's 0.025em `tracking-wide`
          to the contract's 0.06em. */}
      <p className="eyebrow">{venue}</p>
      <h1 className="mt-2 text-2xl font-extrabold">
        Two stamps to start your card
      </h1>
      <p className="mt-3 text-ink-soft">
        {venue} has invited you to their loyalty card. Collect two welcome
        stamps — there&apos;s no app to download. You&apos;ll verify your phone,
        then you&apos;re in.
      </p>
      <form action={startInviteClaimAction} className="mt-5">
        <input type="hidden" name="token" value={token} />
        <SubmitButton>Collect your two stamps</SubmitButton>
      </form>
      <p className="mt-4 text-xs text-ink-soft">
        This invitation expires 30 days after it was sent.{" "}
        <Link href="/privacy" className="underline">
          Privacy notice
        </Link>
        .
      </p>
    </>
  )
}

function InviteUnavailable({ expired }: { expired: boolean }) {
  return (
    <>
      <h1 className="text-2xl font-extrabold">
        {expired
          ? "This invitation has expired"
          : "This invitation link isn't available"}
      </h1>
      <p className="mt-3 text-ink-soft">
        {expired
          ? "Invitation links are valid for 30 days. Ask the venue for a fresh one."
          : "This link may have already been used or withdrawn. If you think this is a mistake, ask the venue."}
      </p>
      <p className="mt-5">
        <Link href="/" className="underline">
          Go to Nabaperks
        </Link>
      </p>
    </>
  )
}
