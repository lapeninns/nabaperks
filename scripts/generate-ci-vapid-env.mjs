import { createECDH } from "node:crypto"
import { pathToFileURL } from "node:url"

const VAPID_SUBJECT = "mailto:ci@example.test"

export function leftPadPrivateKey(value) {
  if (!Buffer.isBuffer(value)) {
    throw new TypeError("VAPID private key must be a Buffer")
  }
  if (value.length > 32) {
    throw new RangeError("VAPID private key cannot exceed 32 bytes")
  }
  if (value.length === 32) return value

  return Buffer.concat([Buffer.alloc(32 - value.length), value])
}

export function generateCiVapidEnvironment() {
  const curve = createECDH("prime256v1")
  curve.generateKeys()

  return {
    WEB_PUSH_VAPID_PUBLIC_KEY: curve.getPublicKey().toString("base64url"),
    WEB_PUSH_VAPID_PRIVATE_KEY: leftPadPrivateKey(curve.getPrivateKey()).toString(
      "base64url"
    ),
    WEB_PUSH_VAPID_SUBJECT: VAPID_SUBJECT,
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const environment = generateCiVapidEnvironment()
  const output = Object.entries(environment)
    .map(([name, value]) => `${name}=${value}`)
    .join("\n")

  process.stdout.write(`${output}\n`)
}
