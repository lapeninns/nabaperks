import { KpiTile } from "nabaperks"
import { Coffee01Icon, GiftIcon, Store01Icon, QrCode01Icon } from "@hugeicons/core-free-icons"

const RISING = [4, 6, 5, 8, 9, 7, 11, 12, 10, 14, 13, 16, 18, 21]
const FALLING = [22, 19, 21, 17, 15, 16, 12, 13, 10, 9, 11, 7, 6, 5]
const STEADY = [8, 9, 8, 8, 7, 9, 8, 8, 9, 8, 8, 9, 8, 8]

export const DashboardGrid = () => (
  <div className="grid max-w-lg grid-cols-2 gap-3">
    <KpiTile
      label="New members"
      value="42"
      icon={Store01Icon}
      series={RISING}
      trend={{ label: "+8 vs last week", direction: "up" }}
    />
    <KpiTile
      label="Stamps issued"
      value="118"
      icon={Coffee01Icon}
      series={FALLING}
      trend={{ label: "−12 vs last week", direction: "down" }}
    />
    <KpiTile
      label="Rewards redeemed"
      value="9"
      icon={GiftIcon}
      series={STEADY}
      trend={{ label: "Same as last week", direction: "flat" }}
    />
    <KpiTile label="QR downloads" value="3" icon={QrCode01Icon} />
  </div>
)

export const Single = () => (
  <div className="max-w-3xs">
    <KpiTile
      label="Repeat visit rate"
      value="46.8%"
      series={RISING}
      trend={{ label: "+2.1pts vs last week", direction: "up" }}
    />
  </div>
)
