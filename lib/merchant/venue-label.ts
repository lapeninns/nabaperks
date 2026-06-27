export function formatMerchantVenueLabel(
  merchantName: string,
  locationName: string
) {
  const merchant = merchantName.trim()
  const location = locationName.trim()

  if (!location || location.toLowerCase() === merchant.toLowerCase()) {
    return merchant
  }

  return `${merchant} · ${location}`
}
