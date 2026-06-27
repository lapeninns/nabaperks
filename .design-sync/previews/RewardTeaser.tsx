import { RewardTeaser } from "nabaperks"

export const Default = () => (
  <div className="max-w-md">
    <RewardTeaser
      locked
      title="Mystery reward"
      description="Collect 8 stamps at Bridge Street Coffee to unlock it."
    />
  </div>
)

export const Unlocked = () => (
  <div className="max-w-md">
    <RewardTeaser
      locked={false}
      title="Free flat white"
      description="Show this to the barista to redeem."
    />
  </div>
)
