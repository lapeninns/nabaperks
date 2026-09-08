/** Only invite mail uses these headers; authentication mail must stay transactional. */
export function inviteUnsubscribeHeaders(
  origin: string,
  kind: "invite" | "claim",
  token: string
): Readonly<Record<string, string>> {
  const encodedToken = encodeURIComponent(token)
  const url = new URL(`/api/email/unsubscribe/${kind}/${encodedToken}`, origin)
  return {
    "List-Unsubscribe": `<${url.href}>, <mailto:unsubscribe@nabaperks.com?subject=${kind}-${encodedToken}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  }
}
