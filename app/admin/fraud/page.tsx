import { EmptyState, PageTitle, SectionHeader } from "@/components/brand"
import { getAdminFraudSignals } from "@/lib/admin/data"

export default async function AdminFraudPage() {
  const fraud = await getAdminFraudSignals()

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Internal admin"
        title="Fraud"
        description="Fraud flags, PIN attempts, and security-related product events."
      />

      <section className="grid gap-4 rounded-3xl border bg-card p-5 shadow-xs">
        <SectionHeader title="Fraud flags" />
        {fraud.fraudFlags.length ? (
          <div className="divide-y">
            {fraud.fraudFlags.map((flag) => {
              const merchant = first(flag.merchants)
              const customer = first(flag.customers)
              return (
                <div
                  key={flag.id}
                  className="grid gap-1 py-3 sm:grid-cols-[1fr_auto]"
                >
                  <div>
                    <p className="font-bold">
                      {flag.signal.replaceAll("_", " ")} · {flag.severity}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {merchant?.business_name ?? "Merchant"}
                      {customer
                        ? ` · ${maskContact(customer.email ?? customer.phone)}`
                        : ""}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {flag.status} · {formatDate(flag.created_at)}
                  </p>
                </div>
              )
            })}
          </div>
        ) : (
          <EmptyState
            title="No fraud flags yet"
            className="rounded-none border-0 p-0 shadow-none"
          />
        )}
      </section>

      <section className="grid gap-4 rounded-3xl border bg-card p-5 shadow-xs">
        <SectionHeader title="Staff PIN attempts" />
        {fraud.pinAttempts.length ? (
          <div className="divide-y">
            {fraud.pinAttempts.map((attempt) => {
              const merchant = first(attempt.merchants)
              return (
                <div
                  key={attempt.id}
                  className="grid gap-1 py-3 sm:grid-cols-[1fr_auto]"
                >
                  <p className="font-bold">
                    {attempt.success ? "Successful PIN" : "Failed PIN"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {merchant?.business_name ?? "Merchant"} ·{" "}
                    {formatDate(attempt.created_at)}
                  </p>
                </div>
              )
            })}
          </div>
        ) : (
          <EmptyState
            title="No PIN attempts yet"
            className="rounded-none border-0 p-0 shadow-none"
          />
        )}
      </section>

      <section className="grid gap-4 rounded-3xl border bg-card p-5 shadow-xs">
        <SectionHeader title="Redemption failures" />
        {fraud.failures.length ? (
          <div className="divide-y">
            {fraud.failures.map((event) => {
              const merchant = first(event.merchants)
              return (
                <div
                  key={event.id}
                  className="grid gap-1 py-3 sm:grid-cols-[1fr_auto]"
                >
                  <p className="font-bold">{event.event_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {merchant?.business_name ?? "Merchant"} ·{" "}
                    {formatDate(event.created_at)}
                  </p>
                </div>
              )
            })}
          </div>
        ) : (
          <EmptyState
            title="No redemption failures yet"
            className="rounded-none border-0 p-0 shadow-none"
          />
        )}
      </section>
    </div>
  )
}

function first<T>(value: T | T[] | null | undefined) {
  if (!value) return undefined
  return Array.isArray(value) ? value[0] : value
}

function maskContact(value?: string | null) {
  if (!value) return "Customer"
  if (value.includes("@")) {
    const [name, domain] = value.split("@")
    return `${name.slice(0, 2)}***@${domain}`
  }
  return `${value.slice(0, 4)}***${value.slice(-2)}`
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}
