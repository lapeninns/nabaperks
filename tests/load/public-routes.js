import { check, sleep } from "k6"
import http from "k6/http"
import { Rate, Trend } from "k6/metrics"

const BASE_URL = __ENV.BASE_URL || "http://127.0.0.1:3000"
const ROUTES = [
  { path: "/signup", slug: "signup" },
  { path: "/privacy", slug: "privacy" },
  { path: "/terms", slug: "terms" },
  { path: "/cookies", slug: "cookies" },
  { path: "/merchant-terms", slug: "merchant-terms" },
  { path: "/data-processing", slug: "data-processing" },
]
const routeSuccess = new Rate("public_route_success")
const routeDuration = new Trend("public_route_duration", true)
const perRouteThresholds = Object.fromEntries(
  ROUTES.flatMap(({ slug }) => [
    [`public_route_success{route:${slug}}`, ["rate>0.99"]],
    [`public_route_duration{route:${slug}}`, ["p(95)<750"]],
  ])
)

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
    ...perRouteThresholds,
  },
}

export default function publicRoutesScenario() {
  const route = ROUTES[__ITER % ROUTES.length]
  const response = http.get(`${BASE_URL}${route.path}`, {
    tags: { route: route.slug },
  })
  const success = response.status >= 200 && response.status < 400

  routeSuccess.add(success, { route: route.slug })
  routeDuration.add(response.timings.duration, { route: route.slug })

  check(response, {
    "public route returns a successful response": () => success,
  })

  sleep(1)
}
