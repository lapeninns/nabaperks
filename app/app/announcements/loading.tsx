import { Megaphone01Icon } from "@hugeicons/core-free-icons"

import { IconRoundel, PageTitle } from "@/components/brand"
import { AnnouncementComposeSkeleton } from "@/components/merchant/loading-skeletons"

/**
 * Announcements' own route fallback (03#66). The composer is not streamed
 * inside the page — the whole page awaits the audience summary — so without
 * this the merchant saw a lone title skeleton and then a full composer
 * dropping in beneath it.
 */
export default function MerchantAnnouncementsLoading() {
  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Announce"
        title="Message your regulars"
        description="Send short venue updates to members who allowed push notifications for your loyalty card."
        actions={
          <IconRoundel
            icon={Megaphone01Icon}
            iconSize={22}
            className="hidden text-muted-foreground sm:grid"
          />
        }
      />
      <AnnouncementComposeSkeleton />
    </div>
  )
}
