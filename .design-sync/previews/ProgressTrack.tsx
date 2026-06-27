import { ProgressTrack } from "nabaperks"

export const Default = () => (
  <div className="max-w-md">
    <ProgressTrack current={5} total={8} />
  </div>
)

export const NearlyThere = () => (
  <div className="max-w-md">
    <ProgressTrack current={7} total={8} label="Two stamps to a free flat white" />
  </div>
)

export const States = () => (
  <div className="grid max-w-md gap-5">
    <ProgressTrack current={0} total={8} label="Just started" />
    <ProgressTrack current={4} total={8} label="Halfway to your reward" />
    <ProgressTrack current={8} total={8} label="Reward ready" />
  </div>
)
