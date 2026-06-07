import { regenerateQrAction, setQrActiveAction } from "@/app/admin/actions"
import { EmptyState, PageTitle, SectionHeader } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { getAdminMerchants, getAdminQrCodes } from "@/lib/admin/data"

export default async function AdminMerchantsPage() {
  const [merchants, qrCodes] = await Promise.all([
    getAdminMerchants(),
    getAdminQrCodes(),
  ])

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Internal admin"
        title="Merchants"
        description="Merchant account, plan status, and QR support controls."
      />

      <section className="overflow-hidden rounded-3xl border bg-card shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-secondary text-xs text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-3">Merchant</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Account</th>
                <th className="px-4 py-3">Billing</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {merchants.map((merchant) => {
                const billing = first(merchant.billing_customers)
                return (
                  <tr key={merchant.id}>
                    <td className="px-4 py-3 font-bold">
                      {merchant.business_name}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {merchant.email}
                    </td>
                    <td className="px-4 py-3">{merchant.status}</td>
                    <td className="px-4 py-3">
                      {billing?.status ?? "not started"}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 rounded-3xl border bg-card p-5 shadow-xs">
        <SectionHeader title="QR records" />
        {qrCodes.length ? (
          <div className="grid gap-3">
            {qrCodes.map((qrCode) => {
              const merchant = first(qrCode.merchants)
              return (
                <article
                  key={qrCode.id}
                  className="grid gap-3 rounded-2xl border p-4"
                >
                  <div className="grid gap-1">
                    <p className="font-mono text-sm font-bold">
                      {qrCode.qr_id}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {merchant?.business_name ?? "Merchant"} ·{" "}
                      {qrCode.is_active ? "active" : "inactive"}
                    </p>
                  </div>
                  <div className="grid gap-2 lg:grid-cols-2">
                    <QrStateForm
                      qrCodeId={qrCode.id}
                      nextActive={!qrCode.is_active}
                    />
                    <RegenerateQrForm qrCodeId={qrCode.id} />
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <EmptyState
            title="No QR records yet"
            className="rounded-none border-0 p-0 shadow-none"
          />
        )}
      </section>
    </div>
  )
}

function QrStateForm({
  qrCodeId,
  nextActive,
}: {
  qrCodeId: string
  nextActive: boolean
}) {
  return (
    <form action={setQrActiveAction} className="grid gap-2">
      <input type="hidden" name="qrCodeId" value={qrCodeId} />
      <input type="hidden" name="isActive" value={String(nextActive)} />
      <input
        name="reason"
        placeholder="Reason"
        className="h-10 rounded-xl border border-input bg-secondary/60 px-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/25"
      />
      <Button
        type="submit"
        variant={nextActive ? "secondary" : "destructive"}
        size="sm"
      >
        {nextActive ? "Enable QR" : "Disable QR"}
      </Button>
    </form>
  )
}

function RegenerateQrForm({ qrCodeId }: { qrCodeId: string }) {
  return (
    <form action={regenerateQrAction} className="grid gap-2">
      <input type="hidden" name="qrCodeId" value={qrCodeId} />
      <input
        name="reason"
        placeholder="Reason"
        className="h-10 rounded-xl border border-input bg-secondary/60 px-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/25"
      />
      <Button type="submit" variant="secondary" size="sm">
        Regenerate QR
      </Button>
    </form>
  )
}

function first<T>(value: T | T[] | null | undefined) {
  if (!value) return undefined
  return Array.isArray(value) ? value[0] : value
}
