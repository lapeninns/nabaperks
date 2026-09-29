import Link from "next/link"

import { resetCustomerSessionAction } from "@/app/home/session/reset/actions"
import { Button } from "@/components/ui/button"

export function WalletLinkNextStep({
  linked,
  recovery,
}: {
  linked?: boolean
  recovery?: "reauthenticate" | "requires_review"
}) {
  if (recovery === "reauthenticate") {
    return (
      <form action={resetCustomerSessionAction}>
        <input type="hidden" name="next" value="/home/profile" />
        <Button type="submit" variant="secondary">
          Sign in again
        </Button>
      </form>
    )
  }
  if (!linked && recovery !== "requires_review") return null
  return (
    <Button asChild variant="secondary">
      <Link href="/home">View my stamps and rewards</Link>
    </Button>
  )
}
