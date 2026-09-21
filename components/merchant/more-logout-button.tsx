"use client"

import { useFormStatus } from "react-dom"
import { Logout01Icon } from "@hugeicons/core-free-icons"

import { Icon } from "@/components/brand"
import { Button } from "@/components/ui/button"

/** Log out, disabled with a label change while the sign-out form submits. */
export function MoreLogoutButton({
  pending: forced = false,
}: {
  pending?: boolean
}) {
  const { pending } = useFormStatus()
  const busy = pending || forced

  return (
    <Button
      type="submit"
      variant="secondary"
      size="lg"
      className="w-full justify-start"
      disabled={busy}
      aria-busy={busy}
    >
      <Icon icon={Logout01Icon} size={18} />
      {busy ? "Logging out…" : "Log out"}
    </Button>
  )
}
