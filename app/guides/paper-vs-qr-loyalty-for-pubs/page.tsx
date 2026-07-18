import {
  GuidePage,
  guidePageMetadata,
} from "@/components/marketing/guides/guide-page"
import { getGuide } from "@/components/marketing/guides/guides-data"

const guide = getGuide("paper-vs-qr-loyalty-for-pubs")

export const metadata = guidePageMetadata(guide)

export default function PaperVsQrLoyaltyForPubsPage() {
  return <GuidePage guide={guide} />
}
