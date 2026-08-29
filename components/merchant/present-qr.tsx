"use client"

import { useState, type ReactNode } from "react"
import { Dialog as DialogPrimitive } from "radix-ui"
import { Cancel01Icon, QrCode01Icon } from "@hugeicons/core-free-icons"

import { Icon } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type PresentQrDetails = {
  readonly qrCodeId: string
  readonly venueName: string
  readonly shareUrl: string
}

/**
 * Composable "present the join QR" dialog. `PresentQrRoot` owns the open state
 * and the full-screen overlay; any number of `PresentQrTrigger` surfaces
 * inside it open the same dialog — the dashboard counter ticket makes both
 * the QR itself and a labelled button triggers of one overlay. The overlay
 * reuses the protected `/app/qr/image/{id}` endpoint the Poster page renders
 * (merchant-cookie scoped), so the browser can serve it from cache.
 */
export function PresentQrRoot({
  qrCodeId,
  venueName,
  shareUrl,
  children,
}: PresentQrDetails & { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const shareLabel = shareUrl.replace(/^https?:\/\//, "")

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      {children}
      <DialogPrimitive.Portal>
        {/* Keyframes (animate-in/out), not transitions: Radix Presence only
            awaits `animationend` on close, so a transition-based exit never
            plays. Full-screen surface fades in place — no slide. */}
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/90 duration-[var(--w-dur-fast)] ease-[var(--w-ease)] supports-backdrop-filter:backdrop-blur-sm motion-reduce:animate-none data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 overflow-y-auto p-5 duration-[var(--w-dur-move)] ease-[var(--w-ease)] focus:outline-none motion-reduce:animate-none sm:gap-6 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
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
            <p className="mono-meta tracking-code text-paper/70">
              Scan to join
            </p>
            <DialogPrimitive.Title className="max-w-[16ch] text-2xl leading-tight font-extrabold text-balance text-paper sm:text-3xl">
              {venueName}
            </DialogPrimitive.Title>
          </div>

          <div className="rounded-lg border-2 border-ink bg-qr-foreground p-4 shadow-2xl sm:p-6">
            {/* eslint-disable-next-line @next/next/no-img-element -- protected QR image needs merchant cookies */}
            <img
              src={`/app/qr/image/${qrCodeId}`}
              alt={`QR code for ${venueName}`}
              width={720}
              height={720}
              className="aspect-square h-auto w-[min(80vmin,32rem)] rounded-lg bg-qr-foreground"
            />
          </div>

          <div className="grid max-w-sm justify-items-center gap-1 text-center">
            <p className="text-sm leading-6 text-balance text-paper/85">
              Customers scan to join and collect today&apos;s stamp — no app to
              download.
            </p>
            <p className="font-mono text-meta tracking-meta break-all text-paper/55">
              {shareLabel}
            </p>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

/** Marks any element inside `PresentQrRoot` as an open-the-overlay surface. */
export function PresentQrTrigger({ children }: { children: ReactNode }) {
  return <DialogPrimitive.Trigger asChild>{children}</DialogPrimitive.Trigger>
}

type PresentQrButtonProps = PresentQrDetails & {
  /** Trigger copy — defaults to the counter phrasing. */
  readonly triggerLabel?: string
  readonly triggerClassName?: string
}

/**
 * One-tap "present the join QR to a customer" launcher — the self-contained
 * form of PresentQrRoot for surfaces that just need the labelled button.
 */
export function PresentQrButton({
  qrCodeId,
  venueName,
  shareUrl,
  triggerLabel = "Show full screen",
  triggerClassName,
}: PresentQrButtonProps) {
  return (
    <PresentQrRoot
      qrCodeId={qrCodeId}
      venueName={venueName}
      shareUrl={shareUrl}
    >
      <PresentQrTrigger>
        <Button
          type="button"
          className={cn("w-full sm:w-auto", triggerClassName)}
        >
          <Icon icon={QrCode01Icon} size={18} />
          {triggerLabel}
        </Button>
      </PresentQrTrigger>
    </PresentQrRoot>
  )
}
