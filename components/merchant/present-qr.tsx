"use client"

import { useState } from "react"
import { Dialog as DialogPrimitive } from "radix-ui"
import { Cancel01Icon, QrCode01Icon } from "@hugeicons/core-free-icons"

import { Icon } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type PresentQrButtonProps = {
  readonly qrCodeId: string
  readonly venueName: string
  readonly shareUrl: string
  /** Trigger copy — defaults to the counter phrasing. */
  readonly triggerLabel?: string
  readonly triggerClassName?: string
}

/**
 * One-tap "present the join QR to a customer" launcher. The trigger sits on the
 * dashboard; activating it opens a full-screen overlay with a large,
 * scanner-safe QR so the merchant can turn their phone or tablet toward the
 * customer without navigating to the Poster page. Reuses the same protected
 * `/app/qr/image/{id}` endpoint the Poster page renders (merchant-cookie
 * scoped), so the browser can serve it from cache.
 */
export function PresentQrButton({
  qrCodeId,
  venueName,
  shareUrl,
  triggerLabel = "Show full screen",
  triggerClassName,
}: PresentQrButtonProps) {
  const [open, setOpen] = useState(false)
  const shareLabel = shareUrl.replace(/^https?:\/\//, "")

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <Button type="button" className={cn("w-full sm:w-auto", triggerClassName)}>
          <Icon icon={QrCode01Icon} size={18} />
          {triggerLabel}
        </Button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/90 opacity-0 transition-opacity duration-[var(--w-dur-fast)] ease-[var(--w-ease)] supports-backdrop-filter:backdrop-blur-sm data-open:opacity-100 data-closed:opacity-0 motion-reduce:transition-none" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 overflow-y-auto p-5 opacity-0 transition-opacity duration-[var(--w-dur-move)] ease-[var(--w-ease)] focus:outline-none data-open:opacity-100 data-closed:opacity-0 motion-reduce:transition-none sm:gap-6"
        >
          <DialogPrimitive.Close asChild>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="absolute top-4 right-4 sm:top-6 sm:right-6"
            >
              <Icon icon={Cancel01Icon} size={20} />
              <span className="sr-only">Close full screen QR</span>
            </Button>
          </DialogPrimitive.Close>

          <div className="grid justify-items-center gap-2 text-center">
            <p className="font-mono text-[11px] font-bold tracking-[0.2em] text-paper/70 uppercase">
              Scan to join
            </p>
            <DialogPrimitive.Title className="max-w-[16ch] text-2xl leading-tight font-extrabold text-balance text-paper sm:text-3xl">
              {venueName}
            </DialogPrimitive.Title>
          </div>

          <div className="rounded-2xl border-2 border-ink bg-white p-4 shadow-[8px_8px_0_var(--w-shadow-color)] sm:p-6">
            {/* eslint-disable-next-line @next/next/no-img-element -- protected QR image needs merchant cookies */}
            <img
              src={`/app/qr/image/${qrCodeId}`}
              alt={`QR code for ${venueName}`}
              width={720}
              height={720}
              className="aspect-square h-auto w-[min(80vmin,32rem)] rounded-lg bg-white"
            />
          </div>

          <div className="grid max-w-sm justify-items-center gap-1 text-center">
            <p className="text-sm leading-6 text-balance text-paper/85">
              Customers scan to join and collect today&apos;s stamp — no app to
              download.
            </p>
            <p className="font-mono text-[11px] tracking-[0.06em] break-all text-paper/55">
              {shareLabel}
            </p>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
