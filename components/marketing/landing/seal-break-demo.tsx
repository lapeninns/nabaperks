"use client"

import { useState } from "react"

import { RewardSeal } from "@/components/loyalty"
import { WetInkPop } from "@/components/motion"
import { Button } from "@/components/ui/button"

import { VenueQr, type QrMatrix } from "./venue-qr"

/**
 * The mystery-reward beat, made tappable so a visitor *feels* the core moment:
 * a sealed sun "?" that breaks into a ready leaf reward with its collection QR.
 * Built from the shared loyalty vocabulary (`RewardSeal` + `WetInkPop`) rather
 * than a bespoke widget, and it settles to a static reveal under reduced motion.
 */
export function SealBreakDemo({ qrMatrix }: { qrMatrix: QrMatrix }) {
  const [broken, setBroken] = useState(false)

  if (!broken) {
    return (
      <div className="grid place-items-center gap-4 text-center">
        <p className="font-mono text-[0.625rem] tracking-[0.06em] text-muted-foreground uppercase">
          Third visit · reward sealed
        </p>
        <button
          type="button"
          onClick={() => setBroken(true)}
          aria-label="Break the seal to reveal the reward"
          className="pressable grid place-items-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/35"
        >
          <RewardSeal state="sealed" size="lg" wiggle />
        </button>
        <p className="font-mono text-[0.625rem] tracking-[0.05em] text-muted-foreground uppercase">
          Tap to break the seal
        </p>
      </div>
    )
  }

  return (
    <WetInkPop active className="block w-full">
      <div className="grid place-items-center gap-2 text-center">
        <RewardSeal state="ready" size="lg" slammed />
        <p className="mt-2 text-xl leading-none font-extrabold tracking-tight">
          Free flat white
        </p>
        <div className="mt-1 inline-flex items-center gap-3 rounded-lg border-2 border-ink bg-white p-1.5 pr-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-md bg-white p-0.5">
            <VenueQr matrix={qrMatrix} label="Reward collection QR code" />
          </span>
          <span className="max-w-[7rem] text-left font-mono text-[0.5rem] leading-relaxed tracking-[0.05em] text-black uppercase">
            One merchant scan to collect
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setBroken(false)}
          className="mt-1"
        >
          Seal it again
        </Button>
      </div>
    </WetInkPop>
  )
}
