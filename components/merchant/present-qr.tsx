"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { Dialog as DialogPrimitive } from "radix-ui"

import { recordConsoleEventAction } from "@/app/app/console-events"
import { Button } from "@/components/ui/button"

type PresentQrDetails = {
  readonly qrCodeId: string
  readonly venueName: string
}

/**
 * Present mode — the full-screen join QR a customer scans at the counter.
 *
 * `PresentQrRoot` owns the open state and the overlay; `PresentQrTrigger`
 * marks the one surface that opens it (the Counter card). Radix gives the
 * dialog semantics: `role="dialog" aria-modal="true"`, focus trapped, Escape
 * closes, focus returns to the trigger. While open the screen wake lock is
 * requested where the API exists and released on close; a refusal is silent
 * because the customer at the bar must never see a toast about it.
 */
export function PresentQrRoot({
  qrCodeId,
  venueName,
  children,
}: PresentQrDetails & { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const openedAt = useRef<number | null>(null)

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next) {
      openedAt.current = Date.now()
      void recordConsoleEventAction({
        name: "counter_qr_presented",
        properties: { source: "card" },
      })
      return
    }
    const duration = openedAt.current ? Date.now() - openedAt.current : 0
    openedAt.current = null
    void recordConsoleEventAction({
      name: "counter_qr_present_closed",
      properties: { duration_ms: Math.max(0, Math.round(duration)) },
    })
  }

  useScreenWakeLock(open)

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      {children}
      <DialogPrimitive.Portal>
        {/* Keyframes (animate-in/out), not transitions: Radix Presence only
            awaits `animationend` on close, so a transition-based exit never
            plays. Full-screen surface fades in place — no slide. */}
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink duration-[var(--w-dur-fast)] ease-[var(--w-ease)] motion-reduce:animate-none data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Content
          aria-modal="true"
          data-present-qr
          className="fixed inset-0 z-50 grid grid-rows-[minmax(0,1fr)_auto] bg-ink text-paper duration-[var(--w-dur-move)] ease-[var(--w-ease)] focus:outline-none motion-reduce:animate-none data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
        >
          {/* Short landscape (h ≤ 460): the code sits beside the heading
              rather than above it so the QR keeps its size. */}
          <div className="grid min-h-0 content-center items-center justify-items-center gap-5 overflow-y-auto px-5 pt-[calc(1.25rem+env(safe-area-inset-top))] pb-4 [@media(max-height:460px)]:grid-cols-[auto_minmax(0,1fr)] [@media(max-height:460px)]:gap-8">
            <div className="rounded-lg border-2 border-ink bg-white p-3 shadow-2xl [@media(max-height:460px)]:order-first">
              {/* eslint-disable-next-line @next/next/no-img-element -- protected QR image needs merchant cookies */}
              <img
                src={`/app/qr/image/${qrCodeId}`}
                alt={`QR code for ${venueName}`}
                width={720}
                height={720}
                className="block aspect-square h-auto w-[min(74vw,66vh,26.25rem)] rounded-md bg-white [@media(max-height:460px)]:w-[min(44vw,70vh,26.25rem)]"
              />
            </div>

            <div className="grid max-w-[22rem] justify-items-center gap-2 text-center [@media(max-height:460px)]:justify-items-start [@media(max-height:460px)]:text-left">
              <DialogPrimitive.Title className="text-2xl leading-tight font-extrabold text-balance text-paper sm:text-3xl">
                Scan to join · {venueName}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="text-base leading-6 text-paper/85">
                Your first stamp is waiting.
              </DialogPrimitive.Description>
              <p className="mono-meta text-paper/70">
                One stamp per business day
              </p>
            </div>
          </div>

          <div className="px-5 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <DialogPrimitive.Close asChild>
              <Button
                type="button"
                variant="ghost"
                size="lg"
                className="w-full text-paper hover:bg-paper/10 hover:text-paper"
              >
                Done
              </Button>
            </DialogPrimitive.Close>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

/** Marks the element inside `PresentQrRoot` that opens present mode. */
export function PresentQrTrigger({ children }: { children: ReactNode }) {
  return <DialogPrimitive.Trigger asChild>{children}</DialogPrimitive.Trigger>
}

type WakeLockSentinel = { release: () => Promise<void> }
type WakeLockNavigator = Navigator & {
  wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinel> }
}

/** Progressive: guarded for browsers without the API, silent on refusal. */
function useScreenWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return
    const wakeLock = (navigator as WakeLockNavigator).wakeLock
    if (!wakeLock) return

    let sentinel: WakeLockSentinel | null = null
    let cancelled = false
    const request = () => {
      wakeLock
        .request("screen")
        .then((lock) => {
          if (cancelled) void lock.release()
          else sentinel = lock
        })
        .catch(() => {
          // Denied or unavailable (low battery, background tab): nothing to say.
        })
    }
    // The browser releases the lock when the tab is hidden; take it again
    // when the operator comes back while present mode is still open.
    const onVisible = () => {
      if (document.visibilityState === "visible") request()
    }
    request()
    document.addEventListener("visibilitychange", onVisible)

    return () => {
      cancelled = true
      document.removeEventListener("visibilitychange", onVisible)
      void sentinel?.release()
    }
  }, [active])
}
