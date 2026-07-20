"use client"

import { useCallback } from "react"
import { usePathname } from "next/navigation"
import { useReportWebVitals } from "next/web-vitals"

import {
  isWebVitalMetricName,
  webVitalRouteKey,
} from "@/lib/analytics/web-vitals-contract"

type WebVitalMetric = Parameters<Parameters<typeof useReportWebVitals>[0]>[0]

export function WebVitalsReporter() {
  const pathname = usePathname()
  const routeKey = webVitalRouteKey(pathname)

  const reportWebVital = useCallback(
    (metric: WebVitalMetric) => {
      if (!routeKey || !isWebVitalMetricName(metric.name)) return

      const body = JSON.stringify({
        metricName: metric.name,
        metricId: metric.id,
        value: metric.value,
        delta: metric.delta,
        rating: metric.rating,
        routeKey,
        navigationType: metric.navigationType,
      })

      if (
        navigator.sendBeacon(
          "/api/analytics/web-vitals",
          new Blob([body], { type: "application/json" })
        )
      ) {
        return
      }

      void fetch("/api/analytics/web-vitals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        cache: "no-store",
        credentials: "same-origin",
        keepalive: true,
      })
    },
    [routeKey]
  )

  useReportWebVitals(reportWebVital)
  return null
}
