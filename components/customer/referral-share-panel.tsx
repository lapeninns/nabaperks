"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  LinkSquare02Icon,
  Tick02Icon,
  UserMultiple02Icon,
} from "@hugeicons/core-free-icons"

import { Eyebrow, Icon, MonoTag } from "@/components/brand"
import { Button } from "@/components/ui/button"
import {
  recordReferralShare,
  rotateReferralCode,
  setReferralCodeActive,
} from "@/lib/customer/referral-share"

/**
 * "Bring a Regular" share panel on the collecting card. The link carries this
 * card's opaque referral_code (`?ref=…`) — never the membership UUID. When an
 * invited friend joins and collects their first in-venue stamp, the friend's
 * normal stamp lands and this card gets one bonus stamp (referral bonus stamp).
 * Uses the Web Share sheet where available, with a copy-to-clipboard fallback.
 */
export function ReferralSharePanel({
  url,
  membershipId,
  venueName,
}: {
  url: string
  membershipId: string
  venueName: string
}) {
  const [copied, setCopied] = useState(false)
  const router = useRouter()
  const [managing, startManaging] = useTransition()

  function resetLink() {
    startManaging(async () => {
      await rotateReferralCode(membershipId)
      router.refresh()
    })
  }

  function pauseInvites() {
    startManaging(async () => {
      await setReferralCodeActive(membershipId, false)
      router.refresh()
    })
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      if (!(error instanceof Error)) throw error
      setCopied(false)
    }
  }

  async function share() {
    void recordReferralShare(membershipId)
    const shareData = {
      title: "Bring a Regular",
      text: `Join me on the ${venueName} loyalty card — collect your first stamp and my card gets a bonus stamp too.`,
      url,
    }
    try {
      if (
        typeof navigator !== "undefined" &&
        typeof navigator.share === "function"
      ) {
        await navigator.share(shareData)
        return
      }
    } catch (error) {
      if (!(error instanceof Error)) throw error
      // Share sheet dismissed or unavailable — fall back to copying the link.
    }
    await copyLink()
  }

  return (
    <section
      data-testid="referral-share-panel"
      className="grid gap-3 rounded-lg border-2 border-ink bg-card p-4 text-left shadow-xs"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 grid size-9 shrink-0 -rotate-6 place-items-center rounded-md border-2 border-ink bg-cobalt text-paper shadow-xs">
            <Icon icon={UserMultiple02Icon} size={18} strokeWidth={2.25} />
          </span>
          <div className="grid min-w-0 gap-1">
            <Eyebrow>Referral</Eyebrow>
            <h2 className="text-base leading-tight font-extrabold text-foreground">
              Bring a regular
            </h2>
            <p className="text-sm leading-6 text-ink-soft">
              Share your link. When they collect their first stamp, your card
              gets one bonus stamp.
            </p>
          </div>
        </div>
        <MonoTag
          tone="cobalt"
          className="hidden shrink-0 min-[360px]:inline-flex"
        >
          Bonus +1
        </MonoTag>
      </div>

      {/* Test/analytics hook: the shareable link, carrying the opaque ref code. */}
      <span data-testid="referral-share-url" data-url={url} className="sr-only">
        {url}
      </span>

      {/* One intent, one primary. Two full-width size="lg" buttons for
          "give someone this link" was a duplicated primary action, and
          `share()` already falls back to `copyLink()` when there is no share
          sheet — so on every device that has one, the second button did
          nothing the first would not (CUS 02#20). Copy is demoted to a link
          under it, still reachable, still announcing "Copied". */}
      <div className="grid justify-items-center gap-1">
        <Button type="button" size="lg" onClick={share} className="w-full">
          <Icon icon={LinkSquare02Icon} size={16} />
          Share your link
        </Button>
        <Button
          type="button"
          size="sm"
          variant="link"
          onClick={copyLink}
          className="text-ink-soft"
        >
          <Icon icon={copied ? Tick02Icon : LinkSquare02Icon} size={16} />
          {copied ? "Copied" : "Copy link"}
        </Button>
      </div>

      {/* Coarse pointers get the 44px tap floor + breathing room; fine
          pointers keep the quiet one-line management row. */}
      <div className="flex items-center justify-center gap-4 pt-0.5 text-xs">
        <button
          type="button"
          onClick={resetLink}
          disabled={managing}
          className="focus-ring inline-flex items-center rounded-sm px-1 font-semibold text-ink-soft underline underline-offset-2 disabled:opacity-50 [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:px-2"
        >
          Reset link
        </button>
        <span aria-hidden className="text-ink-soft/50">
          ·
        </span>
        <button
          type="button"
          onClick={pauseInvites}
          disabled={managing}
          className="focus-ring inline-flex items-center rounded-sm px-1 font-semibold text-ink-soft underline underline-offset-2 disabled:opacity-50 [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:px-2"
        >
          Pause invites
        </button>
      </div>
    </section>
  )
}
