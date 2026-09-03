import {
  assertProductionAlertEnvelope,
  buildProductionAlertEmail,
  deliverVerifiedProductionAlert,
  ProductionAlertError,
  sha256Hex,
  verifyProductionAlert,
} from "../_shared/production-alert-core.mjs"

const JSON_HEADERS = { "content-type": "application/json" }

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), { headers: JSON_HEADERS, status })
}

async function rpc(name, body) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  if (!supabaseUrl || !serviceRoleKey)
    throw new Error("database_not_configured")
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) throw new Error(`database_${name}_failed`)
  if (response.status === 204) return {}
  return response.json()
}

async function sendEmail(payload, recipient) {
  const apiKey = Deno.env.get("RESEND_API_KEY") ?? ""
  const sender = Deno.env.get("RESEND_FROM") ?? ""
  if (!apiKey || !sender || !recipient) throw new Error("paging_not_configured")
  const message = buildProductionAlertEmail(payload)
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      "idempotency-key": `nabaperks-production-alert/${payload.deliveryId}`,
    },
    body: JSON.stringify({
      from: sender,
      to: [recipient],
      subject: message.subject,
      text: message.text,
    }),
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) throw new Error("paging_provider_failed")
}

Deno.serve(async (request) => {
  let payload
  let bodyBytes
  try {
    assertProductionAlertEnvelope({
      method: request.method,
      contentType: request.headers.get("content-type"),
      contentLength: request.headers.get("content-length"),
    })
    bodyBytes = new Uint8Array(await request.arrayBuffer())
    payload = await verifyProductionAlert({
      method: request.method,
      contentType: request.headers.get("content-type"),
      contentLength: request.headers.get("content-length"),
      signature: request.headers.get("x-nabaperks-signature"),
      timestamp: request.headers.get("x-nabaperks-timestamp"),
      delivery: request.headers.get("x-nabaperks-delivery"),
      bodyBytes,
      secret: Deno.env.get("PRODUCTION_ALERT_WEBHOOK_SECRET") ?? "",
    })
  } catch (error) {
    if (error instanceof ProductionAlertError) {
      return jsonResponse(error.status, { accepted: false, error: error.code })
    }
    return jsonResponse(500, { accepted: false, error: "verification_failed" })
  }

  try {
    const result = await deliverVerifiedProductionAlert({
      payload,
      payloadHash: await sha256Hex(bodyBytes),
      claimDelivery: ({ payload: alert, payloadHash }) =>
        rpc("claim_production_alert", {
          p_delivery_id: alert.deliveryId,
          p_action: alert.action,
          p_kind: alert.kind,
          p_dedup_key: alert.dedupKey,
          p_payload_hash: payloadHash,
          p_occurred_at: alert.occurredAt,
          p_run_url: alert.runUrl,
          p_revision: alert.revision,
        }),
      sendPage: sendEmail,
      completeDelivery: (deliveryId) =>
        rpc("complete_production_alert_delivery", {
          p_delivery_id: deliveryId,
        }),
    })
    return jsonResponse(202, result)
  } catch (error) {
    if (error instanceof ProductionAlertError) {
      return jsonResponse(error.status, { accepted: false, error: error.code })
    }
    return jsonResponse(500, { accepted: false, error: "delivery_failed" })
  }
})
