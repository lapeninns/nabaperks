"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"

export function CopyUrlButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)
  const [failed, setFailed] = useState(false)

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setFailed(false)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
      setFailed(true)
    }
  }

  return (
    <span className="inline-grid gap-1">
      <Button type="button" variant="secondary" onClick={copyUrl}>
        {copied ? "Copied" : "Copy URL"}
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
