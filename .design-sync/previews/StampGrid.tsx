import { StampGrid } from "nabaperks"

export const Default = () => (
  <div className="max-w-md">
    <StampGrid current={5} total={8} venueName="Bridge Street Coffee" venueInitials="BS" />
  </div>
)

export const WithRewardSlot = () => (
  <div className="max-w-md">
    <StampGrid current={7} total={8} rewardSlot="locked" venueInitials="BS" />
  </div>
)

export const States = () => (
  <div className="grid max-w-md gap-4">
    <StampGrid current={0} total={6} venueInitials="BS" />
    <StampGrid current={3} total={6} venueInitials="BS" />
    <StampGrid current={6} total={6} rewardSlot="ready" venueInitials="BS" />
  </div>
)

export const Compact = () => (
  <div className="max-w-xs">
    <StampGrid current={4} total={6} rewardSlot="locked" compact venueInitials="BS" />
  </div>
)
