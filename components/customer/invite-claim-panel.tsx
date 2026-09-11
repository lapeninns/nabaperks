import Link from "next/link"

import { SubmitButton } from "@/components/forms"

export type InviteClaimStatus = "available" | "expired" | "unavailable"

export function InviteClaimPanel({
  status,
  businessName,
  token,
  startAction,
}: {
  status: InviteClaimStatus
  businessName: string | null
  token: string
  startAction: (formData: FormData) => void | Promise<void>
}) {
  return (
    <main className="mx-auto grid min-h-dvh max-w-md content-center gap-6 p-6 text-ink">
      <div className="rounded-lg border-2 border-ink bg-paper p-6">
        {status === "available" ? (
          <InviteAvailable
            businessName={businessName}
            token={token}
            startAction={startAction}
          />
        ) : (
          <InviteUnavailable expired={status === "expired"} />
        )}
      </div>
    </main>
  )
}

function InviteAvailable({
  businessName,
  token,
  startAction,
}: {
  businessName: string | null
  token: string
  startAction: (formData: FormData) => void | Promise<void>
}) {
  const venue = businessName?.trim() || "A local venue"
  return (
    <>
      <p className="font-mono text-xs tracking-wide text-ink-soft uppercase">
        {venue}
      </p>
      <h1 className="mt-2 text-2xl font-extrabold">
        Two stamps to start your card
      </h1>
      <p className="mt-3 text-ink-soft">
        {venue} has invited you to their loyalty card. Collect two welcome
        stamps — there&apos;s no app to download. You&apos;ll verify your phone,
        then you&apos;re in.
      </p>
      <form action={startAction} className="mt-5">
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
