import { FunnelChart } from "nabaperks"

export const Default = () => (
  <div className="max-w-2xl">
    <FunnelChart
      items={[
        { label: "Scanned table QR", value: 1240 },
        { label: "Joined loyalty card", value: 812 },
        { label: "Earned first stamp", value: 689 },
        { label: "Completed a card", value: 214 },
        { label: "Redeemed reward", value: 187 },
      ]}
    />
  </div>
)

export const SteepDropOff = () => (
  <div className="max-w-2xl">
    <FunnelChart
      items={[
        { label: "Saw counter sign", value: 980 },
        { label: "Scanned QR", value: 305 },
        { label: "Joined card", value: 142 },
        { label: "Returned for stamp 2", value: 38 },
      ]}
    />
  </div>
)
