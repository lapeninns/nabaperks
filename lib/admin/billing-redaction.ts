export type AdminBillingStatusTone = "neutral" | "good" | "warning" | "danger"

export type AdminBillingStatusPresentation = {
  readonly label: string
  readonly tone: AdminBillingStatusTone
}

export function maskStripeOperationalId(value: string | null | undefined) {
  const trimmed = value?.trim()
  if (!trimmed) return "-"

  const separatorIndex = trimmed.indexOf("_")
  const prefix =
    separatorIndex > 0 ? trimmed.slice(0, separatorIndex + 1) : ""

  return `${prefix}...${trimmed.slice(-6)}`
}

export function formatAdminBillingStatus(
  status: string | null | undefined
): AdminBillingStatusPresentation {
  const normalized = status?.trim().toLowerCase() ?? ""

  switch (normalized) {
    case "active":
      return { label: "Active", tone: "good" }
    case "trial":
      return { label: "Trial", tone: "good" }
    case "trialing":
      return { label: "Trialing", tone: "good" }
    case "past_due":
      return { label: "Past due", tone: "warning" }
    case "incomplete":
      return { label: "Incomplete", tone: "warning" }
    case "cancelled":
    case "canceled":
      return { label: "Cancelled", tone: "danger" }
    case "suspended":
      return { label: "Suspended", tone: "danger" }
    case "":
      return { label: "No billing record", tone: "neutral" }
    default:
      return { label: humanizeBillingStatus(normalized), tone: "neutral" }
  }
}

function humanizeBillingStatus(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((part, index) => (index === 0 ? capitalize(part) : part))
    .join(" ")
}

function capitalize(value: string) {
  return value.length > 0
    ? `${value.charAt(0).toUpperCase()}${value.slice(1)}`
    : value
}
