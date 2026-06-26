/** Optional browser Maps key — blank when unset or still a placeholder. */
export function getGoogleMapsPublicKey(): string {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? ""

  if (!key || /replace/i.test(key)) {
    return ""
  }

  return key
}
