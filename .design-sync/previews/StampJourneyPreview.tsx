import { StampJourneyPreview } from "nabaperks"

export const Default = () => (
  <div className="max-w-md">
    <StampJourneyPreview total={8} venueName="Bridge Street Coffee" />
  </div>
)

export const ShortCard = () => (
  <div className="max-w-xs">
    <StampJourneyPreview total={6} venueName="Bridge Street Coffee" />
  </div>
)
