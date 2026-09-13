import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons"

import { Icon } from "@/components/brand"
import { Button } from "@/components/ui/button"

export function GoogleReviewButton({
  url,
  venueName,
}: {
  url: string
  venueName: string
}) {
  return (
    <Button
      asChild
      size="sm"
      variant="outline"
      className="h-auto min-h-11 w-full py-2 whitespace-normal"
    >
      <a href={url} target="_blank" rel="noreferrer">
        <span className="min-w-0 [overflow-wrap:anywhere]">
          Review {venueName} on Google
        </span>
        <Icon icon={ArrowUpRight01Icon} size={14} />
      </a>
    </Button>
  )
}
