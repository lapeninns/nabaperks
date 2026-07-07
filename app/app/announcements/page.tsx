import { redirect } from "next/navigation"
import { Megaphone01Icon } from "@hugeicons/core-free-icons"

import { Icon, PageTitle } from "@/components/brand"
import { AnnouncementCompose } from "@/components/merchant/announcements/announcement-compose"
import { announcementTemplatesForBusinessType } from "@/lib/notifications/announcement-templates"
import { getCurrentMerchant } from "@/lib/auth/session"
import {
  getVenueAnnouncementAudienceSummary,
  getVenueAnnouncementDailyUsage,
} from "@/lib/notifications/venue-announcements"

export const dynamic = "force-dynamic"

export default async function MerchantAnnouncementsPage() {
  const merchant = await getCurrentMerchant()

  if (!merchant) {
    redirect("/app/onboarding")
  }

  const [audienceSummary, dailyUsage] = await Promise.all([
    getVenueAnnouncementAudienceSummary(merchant.id),
    getVenueAnnouncementDailyUsage(merchant.id),
  ])

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Announce"
        title="Message your regulars"
        description="Send short venue updates to members who allowed push notifications for your loyalty card."
        actions={
          <span className="hidden size-11 place-items-center rounded-full border-2 border-ink bg-secondary text-muted-foreground sm:grid">
            <Icon icon={Megaphone01Icon} size={22} />
          </span>
        }
      />

      <section aria-label="Announcement composer">
        <AnnouncementCompose
          audienceSummary={audienceSummary}
          dailyUsage={dailyUsage}
          templates={announcementTemplatesForBusinessType(
            merchant.business_type
          )}
        />
      </section>
    </div>
  )
}
