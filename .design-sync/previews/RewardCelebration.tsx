import { RewardCelebration } from "nabaperks"

export const Default = () => (
  <div className="max-w-xs">
    <RewardCelebration
      title="Card complete!"
      message="Your free flat white is unlocked. Show this to the barista on your next visit."
    />
  </div>
)

export const Variant = () => (
  <div className="max-w-xs">
    <RewardCelebration
      title="That's 8 stamps"
      message="Bridge Street Coffee is treating you — your reward is ready at the counter."
    />
  </div>
)
