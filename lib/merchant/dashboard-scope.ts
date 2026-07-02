export type MerchantDashboardScopeInput = {
  readonly locationId?: string | readonly string[] | null
}

export type MerchantDashboardScope =
  | { readonly mode: "merchant" }
  | { readonly mode: "location"; readonly locationId: string }

export const SHARED_MEMBERS_CAPTION = "Members are shared across your sites"

export function resolveMerchantDashboardScope(
  input: MerchantDashboardScopeInput = {}
): MerchantDashboardScope {
  const locationId = firstScopeValue(input.locationId)?.trim()

  if (!locationId) {
    return { mode: "merchant" }
  }

  return { mode: "location", locationId }
}

export function dashboardScopeMembersCaption(
  input: MerchantDashboardScopeInput = {}
) {
  return resolveMerchantDashboardScope(input).mode === "location"
    ? SHARED_MEMBERS_CAPTION
    : null
}

function firstScopeValue(value: MerchantDashboardScopeInput["locationId"]) {
  return typeof value === "string" ? value : value?.[0]
}
