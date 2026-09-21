"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function CopyUrlButton({
  url,
  variant = "secondary",
  label = "Copy URL",
  className,
}: {
  url: string
  /** `link` renders as an underlined ink text link (the Counter card's
   *  secondary affordance); the default keeps the secondary button. */
  variant?: "secondary" | "link"
  label?: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)
  const [failed, setFailed] = useState(false)

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setFailed(false)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      // Mirror the failure visibly (the sr-only line alone left sighted
      // merchants staring at a silently unchanged "Copy URL").
      setCopied(false)
      setFailed(true)
      window.setTimeout(() => setFailed(false), 2400)
    }
  }

  return (
    <span className="inline-grid gap-1">
      <Button
        type="button"
        variant={variant}
        className={cn(
          variant === "link" && "text-foreground underline",
          className
        )}
        onClick={copyUrl}
      >
        {failed ? "Copy failed — copy it by hand" : copied ? "Copied" : label}
      </Button>
      <span className="sr-only" aria-live="polite">
        {failed
          ? "Copy failed. Use the visible shareable URL instead."
          : copied
            ? "Shareable URL copied."
            : ""}
      </span>
    </span>
  )
}
