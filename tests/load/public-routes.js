import { check, sleep } from "k6"
import http from "k6/http"

const BASE_URL = __ENV.BASE_URL || "http://127.0.0.1:3000"
const ROUTES = [
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
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<750"],
  },
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
