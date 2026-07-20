import "server-only"

import type { WebVitalSample } from "@/lib/analytics/web-vitals-contract"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export async function recordWebVitalSample(sample: WebVitalSample) {
  const supabase = createSupabaseServiceRoleClient()
  const { error } = await supabase.from("web_vital_samples").insert({
    metric_name: sample.metricName,
    metric_id: sample.metricId,
    value: sample.value,
    delta: sample.delta,
    rating: sample.rating,
    route_key: sample.routeKey,
    navigation_type: sample.navigationType,
  })

  if (error) {
    throw new Error(
      `Unable to record browser performance sample: ${error.message}`
    )
  }
}
