import { createHmac } from "node:crypto"

const [url, body = ""] = process.argv.slice(2)
if (url === "--help") {
  console.log(
    "Usage: TWILIO_AUTH_TOKEN=<local fixture token> node scripts/dev/twilio-webhook-sign.mjs <exact callback URL> <form body>"
  )
} else if (!url || !process.env.TWILIO_AUTH_TOKEN) {
  console.error("An exact callback URL and TWILIO_AUTH_TOKEN are required.")
  process.exitCode = 1
} else {
  const parsedUrl = new URL(url)
  if (
    !["http:", "https:"].includes(parsedUrl.protocol) ||
    parsedUrl.hash ||
    parsedUrl.username ||
    parsedUrl.password
  )
    throw new Error("Invalid callback URL")
  decodeURIComponent(body.replace(/\+/g, " "))
  const params = new URLSearchParams(body)
  const keys = [...params.keys()]
  if (new Set(keys).size !== keys.length || keys.some((key) => !key))
    throw new Error("Duplicate or empty form field")
  const payload = keys
    .sort()
    .reduce((value, key) => value + key + params.get(key), url)
  console.log(
    createHmac("sha1", process.env.TWILIO_AUTH_TOKEN)
      .update(payload)
      .digest("base64")
  )
}
