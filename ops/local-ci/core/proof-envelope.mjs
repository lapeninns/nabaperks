import { sign, verify } from "node:crypto"

/** Deterministic JSON for the closed, JSON-only envelope schema. */
function canonicalProofJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value))
    return `[${value.map(canonicalProofJson).join(",")}]`
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalProofJson(value[key])}`)
    .join(",")}}`
}

/** Only the credential-bearing supervisor may sign, after collecting results. */
export function signProofEnvelope(payload, privateKey) {
  return {
    payload,
    signature: sign(
      null,
      Buffer.from(canonicalProofJson(payload)),
      privateKey
    ).toString("base64"),
  }
}

export function verifyEnvelopeSignature(envelope, publicKey) {
  try {
    if (!/^[A-Za-z0-9+/]{86}==$/.test(envelope.signature)) return false
    return verify(
      null,
      Buffer.from(canonicalProofJson(envelope.payload)),
      publicKey,
      Buffer.from(envelope.signature, "base64")
    )
  } catch {
    return false
  }
}
