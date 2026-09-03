import "server-only"

import type { WebVitalSample } from "@/lib/analytics/web-vitals-contract"
import { RateLimitError } from "@/lib/security/rate-limit"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export async function recordWebVitalSample(sample: WebVitalSample) {
  const supabase = createSupabaseServiceRoleClient()
  const { error } = await supabase.rpc("record_web_vital_sample", {
    p_metric_name: sample.metricName,
    p_metric_id: sample.metricId,
    p_value: sample.value,
    p_delta: sample.delta,
    p_rating: sample.rating,
    p_route_key: sample.routeKey,
    p_navigation_type: sample.navigationType,
  })

  if (error) {
    if (/rate limit exceeded/i.test(error.message)) {
      throw new RateLimitError()
    }
    throw new Error(
      `Unable to record browser performance sample: ${error.message}`
    )
  }
}
