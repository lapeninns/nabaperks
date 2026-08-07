import type { Metadata } from "next"
import { cookies } from "next/headers"
import { connection } from "next/server"

import { signOutAction } from "@/app/(auth)/actions"

import Link from "next/link"
import { SquareLockPasswordIcon } from "@hugeicons/core-free-icons"

import { AdminMfaStepUp } from "@/components/admin/mfa-step-up"
import { EmptyState } from "@/components/brand"
import { AdminShell } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { getAdminAccess } from "@/lib/admin/auth"
import { adminMfaStepUpRequired } from "@/lib/admin/mfa-gate"
import { PRIVATE_ROUTE_METADATA } from "@/lib/seo/metadata"

export const metadata: Metadata = PRIVATE_ROUTE_METADATA

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await connection()
  const access = await getAdminAccess()

  if (access.status !== "allowed") {
    // Was a dead end: a card with "Access denied" and the raw, developer-facing
    // reason string, and no action at all. Now the EmptyState anatomy with its
    // actions slot, with the technical reason demoted to a .mono-id reference
    // line exactly as app/admin/error.tsx already does.
    return (
      <main className="mx-auto grid min-h-svh w-full max-w-2xl place-items-center px-6 py-10">
        <EmptyState
          icon={SquareLockPasswordIcon}
          title="Access denied"
          description={
            <>
              This area is limited to internal admin accounts. Sign in with an
              admin account, or ask an existing internal admin to grant access.
              {access.reason ? (
                <span className="mono-id mt-2 block">
                  Reason: {access.reason}
                </span>
              ) : null}
            </>
          }
          actions={
            <>
              <Button asChild>
                <Link href="/login?next=/admin">Sign in</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/">Back to home</Link>
              </Button>
              <form action={signOutAction}>
                <Button type="submit" variant="ghost">
                  Sign out
                </Button>
              </form>
            </>
          }
        />
      </main>
    )
  }

  // Enrolled admin whose session is still aal1: block ALL admin content behind a
  // step-up challenge. This card is the only admin surface rendered in this
  // state, so it can always be completed — no lockout.
  if (adminMfaStepUpRequired(access.mfaState)) {
    return (
      <AdminMfaStepUp
        operatorEmail={access.email}
        signOutAction={signOutAction}
      />
    )
  }

  // Seed the desktop expanded/collapsed rail from the persisted sidebar
  // cookie, exactly as the merchant console does, so a collapsed console
  // survives a reload.
  const cookieStore = await cookies()
  const sidebarCookieOpen = cookieStore.get("sidebar_state")?.value !== "false"

  return (
    <AdminShell
      operatorEmail={access.email}
      mfaRequired={access.mfaRequired}
      signOutAction={signOutAction}
      defaultSidebarOpen={sidebarCookieOpen}
    >
      {children}
    </AdminShell>
  )
}
