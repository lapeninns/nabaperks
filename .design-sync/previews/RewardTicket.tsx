import { RewardTicket } from "nabaperks"

export const Default = () => (
  <div className="max-w-md">
    <RewardTicket
      state="sealed"
      name="Mystery reward"
      description="Collect 8 stamps at Bridge Street Coffee to reveal it."
    />
  </div>
)

export const States = () => (
  <div className="grid max-w-md gap-4">
    <RewardTicket
      state="sealed"
      name="Mystery reward"
      description="Two more stamps to unlock."
    />
    <RewardTicket
      state="waiting"
      name="Free flat white"
      description="Unlocked — resting until it's ready."
      readyDate="Mon 30 Jun"
    />
    <RewardTicket
      state="ready"
      name="Free flat white"
      description="Show this to the barista to redeem."
    />
    <RewardTicket state="redeemed" name="Free flat white" />
  </div>
)
