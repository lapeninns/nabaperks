const PUBLIC_QR_ID = /^[A-Za-z0-9_-]{1,128}$/

export function isValidPublicQrId(qrId: string): boolean {
  return PUBLIC_QR_ID.test(qrId)
}

export function qrScanIdentityRateLimitKey(identity: string): string {
  return `qr-scan:identity:${identity}`
}

export function qrScanCodeRateLimitKey(qrId: string, identity: string): string {
  return `qr-scan:code:${qrId}:${identity}`
}
