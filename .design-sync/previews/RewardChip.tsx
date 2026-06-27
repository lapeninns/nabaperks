import { RewardChip } from "nabaperks"

export const Default = () => (
  <div className="max-w-[5rem]">
    <RewardChip slotState="locked" />
  </div>
)

export const SlotStates = () => (
  <div className="flex max-w-md flex-wrap items-start gap-6">
    <RewardChip slotState="locked" label="Mystery reward" />
    <RewardChip slotState="ready" label="Free flat white" />
    <RewardChip slotState="revealed" label="Free flat white" />
  </div>
)

export const Compact = () => (
  <div className="max-w-[3.5rem]">
    <RewardChip slotState="locked" compact />
  </div>
)
