"use client"

import { useState } from "react"
import {
  LinkSquare02Icon,
  Tick02Icon,
  UserMultiple02Icon,
} from "@hugeicons/core-free-icons"

import { Icon } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { recordReferralShare } from "@/lib/customer/referral-share"

/**
 * "Bring a Regular" share panel on the collecting card. The link carries this
 * card's opaque referral_code (`?ref=…`) — never the membership UUID. When an
 * invited friend joins and collects their first in-venue stamp, both cards get a
 * stamp (MS-referral-bonus-stamp). Uses the Web Share sheet where available, with
 * a copy-to-clipboard fallback.
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

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  async function share() {
    void recordReferralShare(membershipId)
    const shareData = {
      title: "Bring a Regular",
      text: `Join me on the ${venueName} loyalty card — when you collect your first stamp, we both get one.`,
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
    } catch {
      // Share sheet dismissed or unavailable — fall back to copying the link.
    }
    await copyLink()
  }

  return (
    <section
      data-testid="referral-share-panel"
      className="grid gap-3 rounded-xl border border-border bg-card p-4 text-left"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-muted text-foreground">
          <Icon icon={UserMultiple02Icon} size={18} />
        </span>
        <div className="grid gap-1">
          <h2 className="text-sm font-black text-foreground">
            Bring a regular
          </h2>
          <p className="text-sm text-ink-soft">
            Know someone who&apos;d love it here? Share your link — when they
            join and collect their first stamp, you both get one.
          </p>
        </div>
      </div>

      {/* Test/analytics hook: the shareable link, carrying the opaque ref code. */}
      <span data-testid="referral-share-url" data-url={url} className="sr-only">
        {url}
      </span>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="lg"
          onClick={share}
          className="min-w-[10rem] flex-1"
        >
          <Icon icon={LinkSquare02Icon} size={16} />
          Share your link
        </Button>
        <Button type="button" size="lg" variant="secondary" onClick={copyLink}>
          <Icon icon={copied ? Tick02Icon : LinkSquare02Icon} size={16} />
          {copied ? "Copied" : "Copy link"}
        </Button>
      </div>
    </section>
  )
}
