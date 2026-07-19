import {
  GuidePage,
  guidePageMetadata,
} from "@/components/marketing/guides/guide-page"
import { getGuide } from "@/components/marketing/guides/guides-data"

const guide = getGuide("reward-regulars-without-an-app")

export const metadata = guidePageMetadata(guide)

export default function RewardRegularsWithoutAnAppPage() {
  return <GuidePage guide={guide} />
}
