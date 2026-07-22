import { SubmitButton } from "@/components/forms"

import { unsubscribeInviteAction } from "./actions"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const metadata = { robots: { index: false, follow: false } }

export default async function InviteUnsubscribePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ done?: string }>
}) {
  const { token } = await params
  const done = (await searchParams)?.done === "1"

  return (
    <main className="mx-auto grid min-h-dvh max-w-md content-center gap-6 p-6 text-ink">
      <div className="rounded-lg border-2 border-ink bg-paper p-6">
        {done ? (
          <>
            <h1 className="text-2xl font-extrabold">
              You&apos;ve unsubscribed
            </h1>
            <p className="mt-3 text-ink-soft">
              You won&apos;t receive further loyalty invitations from this
              venue.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-extrabold">Unsubscribe</h1>
            <p className="mt-3 text-ink-soft">
              Stop receiving loyalty invitations from this venue?
            </p>
            <form action={unsubscribeInviteAction} className="mt-5">
              <input type="hidden" name="token" value={token} />
              <SubmitButton>Yes, unsubscribe</SubmitButton>
            </form>
          </>
        )}
      </div>
    </main>
  )
}
