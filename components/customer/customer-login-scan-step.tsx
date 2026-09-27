import Link from "next/link"
import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"

/**
 * /home/login after a valid code for a contact that holds no cards. A new
 * visitor joins at the venue, so the step points at the QR instead of offering
 * another code; `children` holds the ways back to the other sign-in choices.
 */
export function CustomerLoginScanStep({
  message,
  children,
}: {
  readonly message?: string
  readonly children?: ReactNode
}) {
  return (
    <div className="grid gap-4">
      <p role="status" className="text-sm leading-6">
        {message}
      </p>
      <Button asChild size="lg" className="w-full">
        <Link href="/scan">Scan a venue QR</Link>
      </Button>
      {children ? <div className="grid gap-1.5">{children}</div> : null}
    </div>
  )
}
