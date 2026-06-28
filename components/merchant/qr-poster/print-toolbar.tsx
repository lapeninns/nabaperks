"use client"

import Link from "next/link"

import { Button } from "@/components/ui/button"

export function PrintToolbar({ backHref }: { readonly backHref: string }) {
  return (
    <div className="qr-poster-toolbar">
      <Button asChild variant="outline">
        <Link href={backHref}>Back to QR</Link>
      </Button>
      <Button type="button" onClick={() => window.print()}>
        Print or save PDF
      </Button>
    </div>
  )
}
