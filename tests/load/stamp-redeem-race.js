import { check, sleep } from "k6"
import http from "k6/http"

const STAMP_URL = __ENV.STAMP_RACE_URL
const REDEEM_URL = __ENV.REDEEM_RACE_URL
const AUTH_TOKEN = __ENV.STAMP_RACE_AUTH_TOKEN
const STAMP_BODY = __ENV.STAMP_RACE_BODY || "{}"
const REDEEM_BODY = __ENV.REDEEM_RACE_BODY || "{}"

if (!STAMP_URL || !REDEEM_URL) {
  throw new Error("STAMP_RACE_URL and REDEEM_RACE_URL are required")
}

export const options = {
  scenarios: {
    stamp_redeem_race: {
      executor: "constant-vus",
      vus: 5,
      duration: "30s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.10"],
    http_req_duration: ["p(95)<1000"],
  },
}

export default function stampRedeemRaceScenario() {
  const headers = { "content-type": "application/json" }
  if (AUTH_TOKEN) {
    headers.authorization = `Bearer ${AUTH_TOKEN}`
  }

  const stamp = http.post(STAMP_URL, STAMP_BODY, { headers })
  const redeem = http.post(REDEEM_URL, REDEEM_BODY, { headers })

  check(stamp, {
    "stamp request settles without server error": (res) =>
      [200, 201, 202, 400, 401, 403, 409, 429].includes(res.status),
  })
  check(redeem, {
    "redeem request settles without server error": (res) =>
      [200, 201, 202, 400, 401, 403, 409, 429].includes(res.status),
  })

  sleep(1)
}
