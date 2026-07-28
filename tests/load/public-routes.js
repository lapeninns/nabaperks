import { check, sleep } from "k6"
import http from "k6/http"

import {
  assertLoadEnvironment,
  resolveSafeLoadTarget,
} from "./target-safety.js"

const target = resolveSafeLoadTarget({
  urls: [__ENV.BASE_URL || "http://127.0.0.1:3000"],
  mode: __ENV.LOAD_TARGET_MODE || "local",
  isolatedStagingOrigin: __ENV.LOAD_ISOLATED_STAGING_ORIGIN,
  isolatedStagingConfirmed: __ENV.LOAD_ISOLATED_STAGING_CONFIRMED,
})
const BASE_URL = target.origin
const ROUTES = [
  "/",
  "/pricing",
  "/signup",
  "/privacy",
  "/terms",
  "/cookies",
  "/merchant-terms",
  "/data-processing",
]

export const options = {
  scenarios: {
    public_routes: {
      executor: "constant-vus",
      vus: 3,
      duration: "45s",
    },
  },
  thresholds: {
    checks: ["rate==1"],
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<750"],
  },
}

export function setup() {
  const response = http.get(`${BASE_URL}/api/health`)
  if (response.status !== 200) {
    throw new Error(`load target health check returned HTTP ${response.status}`)
  }
  assertLoadEnvironment(response.json(), target.mode)
}

export default function publicRoutesScenario() {
  const route = ROUTES[__ITER % ROUTES.length]
  const response = http.get(`${BASE_URL}${route}`)

  check(response, {
    "public route returns a successful response": (res) =>
      res.status >= 200 && res.status < 400,
  })

  sleep(1)
}
