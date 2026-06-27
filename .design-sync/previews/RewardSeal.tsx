import { RewardSeal } from "nabaperks"

export const Default = () => <RewardSeal state="sealed" />

export const States = () => (
  <div className="flex flex-wrap items-center gap-6">
    <RewardSeal state="sealed" />
    <RewardSeal state="waiting" />
    <RewardSeal state="ready" />
    <RewardSeal state="redeemed" />
  </div>
)

export const Sizes = () => (
  <div className="flex flex-wrap items-center gap-6">
    <RewardSeal state="ready" size="sm" />
    <RewardSeal state="ready" size="md" />
    <RewardSeal state="ready" size="lg" label="Free flat white, ready" />
  </div>
)
