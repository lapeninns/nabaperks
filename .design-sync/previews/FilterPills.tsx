import { FilterPills } from "nabaperks"

const MEMBER_FILTERS = [
  { id: "all", label: "All", count: 148 },
  { id: "active", label: "Active", count: 92 },
  { id: "lapsed", label: "Lapsed", count: 35 },
]

export const WithCounts = () => (
  <div className="max-w-md">
    <FilterPills
      items={MEMBER_FILTERS}
      value="active"
      onValueChange={() => {}}
      aria-label="Filter members"
    />
  </div>
)

export const Plain = () => (
  <div className="max-w-sm">
    <FilterPills
      items={[
        { id: "week", label: "This week" },
        { id: "month", label: "This month" },
        { id: "all", label: "All time" },
      ]}
      value="week"
      onValueChange={() => {}}
      aria-label="Filter activity period"
    />
  </div>
)
