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
    <Button asChild size="sm" variant="outline" className="w-full">
      <a href={url} target="_blank" rel="noreferrer">
        Review {venueName} on Google
        <Icon icon={ArrowUpRight01Icon} size={14} />
      </a>
    </Button>
  )
}
