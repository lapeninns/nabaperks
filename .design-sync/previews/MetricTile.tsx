import { MetricTile } from "nabaperks"
import { Coffee01Icon, GiftIcon, Store01Icon } from "@hugeicons/core-free-icons"

export const Default = () => (
  <div className="max-w-3xs">
    <MetricTile label="Stamps issued today" value="142" />
  </div>
)

export const WithTrend = () => (
  <div className="grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-3">
    <MetricTile
      label="New members"
      value="38"
      icon={Store01Icon}
      trend={{ label: "+12 vs last week", direction: "up" }}
    />
    <MetricTile
      label="Stamps issued"
      value="142"
      icon={Coffee01Icon}
      trend={{ label: "+9 vs last week", direction: "up" }}
    />
    <MetricTile
      label="Rewards redeemed"
      value="11"
      icon={GiftIcon}
      trend={{ label: "−3 vs last week", direction: "down" }}
    />
  </div>
)

export const WithHelper = () => (
  <div className="max-w-xs">
    <MetricTile
      label="Repeat visit rate"
      value="46.8%"
      helper="Members who returned within 30 days of their first stamp."
      trend={{ label: "Same as last week", direction: "flat" }}
    />
  </div>
)
