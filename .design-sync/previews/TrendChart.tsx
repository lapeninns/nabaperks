import { TrendChart } from "nabaperks"

export const TwoSeries = () => (
  <div className="max-w-2xl">
    <TrendChart
      aria-label="Stamps and rewards over the last 14 days"
      startLabel="14 days ago"
      endLabel="Today"
      series={[
        {
          label: "Stamps",
          color: "var(--primary)",
          fill: true,
          data: [8, 11, 9, 14, 12, 16, 13, 18, 15, 21, 17, 22, 19, 24],
        },
        {
          label: "Rewards",
          color: "var(--w-cobalt)",
          data: [1, 2, 1, 3, 2, 2, 4, 3, 2, 4, 3, 5, 4, 6],
        },
      ]}
    />
  </div>
)

export const NothingYet = () => (
  <div className="max-w-2xl">
    <TrendChart
      aria-label="No activity recorded yet"
      startLabel="Launch day"
      endLabel="Today"
      series={[
        { label: "Stamps", color: "var(--primary)", fill: true, data: [0, 0, 0, 0, 0, 0, 0] },
      ]}
    />
  </div>
)
