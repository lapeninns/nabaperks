import { DataTable, Badge } from "nabaperks"

type Redemption = {
  id: string
  customer: string
  reward: string
  date: string
  status: "Claimed" | "Pending"
}

const redemptions: Redemption[] = [
  {
    id: "rdm-2041",
    customer: "Maya Reyes",
    reward: "9th coffee free",
    date: "27 Jun 2026",
    status: "Claimed",
  },
  {
    id: "rdm-2040",
    customer: "Tom Okafor",
    reward: "Free oat latte",
    date: "27 Jun 2026",
    status: "Claimed",
  },
  {
    id: "rdm-2039",
    customer: "Priya Nadar",
    reward: "Pastry of the day",
    date: "26 Jun 2026",
    status: "Pending",
  },
  {
    id: "rdm-2038",
    customer: "Liam Doyle",
    reward: "9th coffee free",
    date: "26 Jun 2026",
    status: "Claimed",
  },
]

const columns = [
  {
    key: "customer",
    header: "Customer",
    cell: (row: Redemption) => <span className="font-bold">{row.customer}</span>,
  },
  {
    key: "reward",
    header: "Reward",
    cell: (row: Redemption) => row.reward,
  },
  {
    key: "date",
    header: "Date",
    cell: (row: Redemption) => (
      <span className="numeric-tabular text-muted-foreground">{row.date}</span>
    ),
  },
  {
    key: "status",
    header: "Status",
    cell: (row: Redemption) => (
      <Badge variant={row.status === "Claimed" ? "reward" : "secondary"}>
        {row.status}
      </Badge>
    ),
  },
]

export const Default = () => (
  <div className="max-w-2xl">
    <DataTable<Redemption>
      caption="Recent rewards redeemed at Bridge Street Coffee"
      columns={columns}
      rows={redemptions}
      getRowKey={(row) => row.id}
    />
  </div>
)

export const Responsive = () => (
  <div className="max-w-2xl">
    <DataTable<Redemption>
      caption="Recent rewards redeemed at Bridge Street Coffee"
      columns={columns}
      rows={redemptions}
      getRowKey={(row) => row.id}
      mobileCard={(row) => (
        <div className="surface-card grid gap-1 p-4">
          <p className="flex items-center justify-between font-bold">
            {row.customer}
            <Badge variant={row.status === "Claimed" ? "reward" : "secondary"}>
              {row.status}
            </Badge>
          </p>
          <p className="text-sm text-muted-foreground">{row.reward}</p>
          <p className="numeric-tabular text-xs text-muted-foreground">{row.date}</p>
        </div>
      )}
    />
  </div>
)

export const Empty = () => (
  <div className="max-w-2xl">
    <DataTable<Redemption>
      caption="Recent rewards redeemed at Bridge Street Coffee"
      columns={columns}
      rows={[]}
      getRowKey={(row) => row.id}
      emptyState={
        <div className="surface-card p-8 text-center text-sm text-muted-foreground">
          No rewards redeemed yet today.
        </div>
      }
    />
  </div>
)
