type ProviderProvenance = {
  source: "manual_entry" | "provider_lookup"
  provider: "" | "google_places"
  id: string
  latitude: string
  longitude: string
}

export function VenueProviderProvenanceFields({
  provenance,
}: {
  provenance: ProviderProvenance
}) {
  return (
    <>
      <input type="hidden" name="addressSource" value={provenance.source} />
      <input type="hidden" name="addressProvider" value={provenance.provider} />
      <input type="hidden" name="addressProviderId" value={provenance.id} />
      <input
        type="hidden"
        name="providerLatitude"
        value={provenance.latitude}
      />
      <input
        type="hidden"
        name="providerLongitude"
        value={provenance.longitude}
      />
    </>
  )
}

export const MANUAL_VENUE_PROVENANCE: ProviderProvenance = {
  source: "manual_entry",
  provider: "",
  id: "",
  latitude: "",
  longitude: "",
}

export type { ProviderProvenance }
