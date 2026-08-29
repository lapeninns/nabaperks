"use client"

import { useState, type ReactNode } from "react"
import { Dialog as DialogPrimitive } from "radix-ui"
import { Cancel01Icon, QrCode01Icon } from "@hugeicons/core-free-icons"

import { Icon } from "@/components/brand"
import { Button } from "@/components/ui/button"

/**
 * "Show at the counter" — the customer-side presentation mode for a scannable
 * code (02#33).
 *
 * Inside a receipt at 375px the framed QR is ~271px, which is fine held still
 * but not when a member is holding a phone across a bar at arm's length in pub
 * lighting. This renders the same code full-bleed on the paper ground with
 * nothing else on screen.
 *
 * The finding also asks for a brightness boost. There is no web API for screen
 * brightness, so that half is genuinely not implementable — the finding itself
 * offers a presentation mode as the minimum, which is what this is. The merchant
 * console has had the equivalent (PresentQr) since launch; the member holding
 * the code did not.
 */
export function PresentCodeButton({
  label,
  title,
  caption,
  children,
}: {
  /** Trigger copy, e.g. "Show at the counter". */
  readonly label: string
  /** Announced dialog title. */
  readonly title: string
  readonly caption?: ReactNode
  /** The code itself — rendered again, larger, inside the overlay. */
  readonly children: ReactNode
}) {
  const [open, setOpen] = useState(false)

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <Button type="button" variant="secondary" size="lg" className="w-full">
          <Icon icon={QrCode01Icon} size={18} />
          {label}
        </Button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/80 motion-reduce:animate-none data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Content className="fixed inset-0 z-50 grid content-center justify-items-center gap-5 bg-paper p-5 motion-reduce:animate-none data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0">
          <DialogPrimitive.Title className="type-page-title text-center text-balance">
            {title}
          </DialogPrimitive.Title>
          <div className="w-[85vw] max-w-[min(85vw,26rem)] rounded-lg border-2 border-ink bg-qr-foreground p-3 shadow-md">
            {children}
          </div>
          {caption ? (
            <p className="mono-meta max-w-[36ch] text-center text-muted-foreground">
              {caption}
            </p>
          ) : null}
          <DialogPrimitive.Close asChild>
            <Button type="button" variant="secondary" size="lg">
              <Icon icon={Cancel01Icon} size={18} />
              Done
            </Button>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
