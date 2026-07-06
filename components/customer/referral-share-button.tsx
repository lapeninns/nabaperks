"use client"

import { useState } from "react"
import { LinkSquare02Icon, Tick02Icon } from "@hugeicons/core-free-icons"

import { Icon } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { recordReferralShare } from "@/lib/customer/referral-share"

/**
 * Compact "Bring a Regular" share control for the home dashboard tile. Shares the
 * card's join link (opaque referral_code) via the Web Share sheet where
 * available, falling back to copying it. The full explanatory panel lives on the
 * card itself; this is the at-a-glance invite affordance on home.
 */
export function ReferralShareButton({
  url,
  membershipId,
  venueName,
}: {
  url: string
  membershipId: string
  venueName: string
}) {
  const [copied, setCopied] = useState(false)

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
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      onClick={share}
      data-testid="referral-share-button"
      data-url={url}
      className="w-full"
    >
      <Icon icon={copied ? Tick02Icon : LinkSquare02Icon} size={14} />
      {copied ? "Link copied" : "Bring a regular"}
    </Button>
  )
}
