import {
  GuidePage,
  guidePageMetadata,
} from "@/components/marketing/guides/guide-page"
import { getGuide } from "@/components/marketing/guides/guides-data"

const guide = getGuide("best-loyalty-ideas-for-pubs")

export const metadata = guidePageMetadata(guide)

export default function BestLoyaltyIdeasForPubsPage() {
  return <GuidePage guide={guide} />
}
