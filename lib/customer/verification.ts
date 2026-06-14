import "server-only"

type VerificationStartResult = { status: "sent" }
type VerificationCheckResult = { status: "approved" | "rejected" }

const verifyBaseUrl = "https://verify.twilio.com/v2/Services"

export async function startCustomerPhoneVerification(
  phone: string
): Promise<VerificationStartResult> {
  await postVerifyForm("Verifications", {
    To: phone,
    Channel: "sms",
  })

  return { status: "sent" }
}

export async function checkCustomerPhoneVerification(
  phone: string,
  code: string
): Promise<VerificationCheckResult> {
  if (isApprovedDevOtp(code)) {
    return { status: "approved" }
  }

  const payload = await postVerifyForm("VerificationCheck", {
    To: phone,
    Code: code,
  })

  return payload.status === "approved"
    ? { status: "approved" }
    : { status: "rejected" }
}

async function postVerifyForm(
  path: "Verifications" | "VerificationCheck",
  params: Record<string, string>
): Promise<{ status: string | null }> {
  const config = twilioVerifyConfig()
  const response = await fetch(
    `${verifyBaseUrl}/${config.serviceSid}/${path}`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${config.username}:${config.password}`
        ).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(params).toString(),
    }
  )

  if (!response.ok) {
    throw new Error(
      `Twilio Verify failed (${response.status}): ${await safeDetail(response)}`
    )
  }

  const payload: unknown = await response.json()
  return { status: readStatus(payload) }
}

function twilioVerifyConfig() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim()
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim()
  const apiKeySid = process.env.TWILIO_API_KEY_SID?.trim()
  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET?.trim()
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID?.trim()

  if (!serviceSid) {
    throw new Error(
      "Twilio Verify is not configured (TWILIO_VERIFY_SERVICE_SID)."
    )
  }

  if (accountSid && authToken) {
    return { username: accountSid, password: authToken, serviceSid }
  }

  if (apiKeySid && apiKeySecret) {
    return { username: apiKeySid, password: apiKeySecret, serviceSid }
  }

  throw new Error(
    "Twilio Verify is not configured (TWILIO_AUTH_TOKEN or TWILIO_API_KEY_SID / TWILIO_API_KEY_SECRET)."
  )
}

function readStatus(payload: unknown): string | null {
  if (!isRecord(payload)) return null

  return typeof payload.status === "string" ? payload.status : null
}

async function safeDetail(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 500)
  } catch {
    return "<no body>"
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isApprovedDevOtp(code: string): boolean {
  const devCode = process.env.CUSTOMER_DEV_OTP_CODE?.trim()

  return process.env.NODE_ENV !== "production" && Boolean(devCode) && code === devCode
}
