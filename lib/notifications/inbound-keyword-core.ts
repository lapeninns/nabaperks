export type InboundKeyword = "stop" | "start" | "help" | "other"

export function parseInboundKeyword(body: string): InboundKeyword {
  const word = body.trim().toUpperCase()
  if (
    [
      "STOP",
      "STOPALL",
      "UNSUBSCRIBE",
      "CANCEL",
      "END",
      "QUIT",
      "REVOKE",
      "OPTOUT",
    ].includes(word)
  )
    return "stop"
  if (["START", "UNSTOP"].includes(word)) return "start"
  if (["HELP", "INFO"].includes(word)) return "help"
  return "other"
}

export function parseTwilioInbound(params: URLSearchParams) {
  const providerMessageSid = params.get("MessageSid")
  const from = params.get("From") ?? ""
  const channel = from.startsWith("whatsapp:") ? "whatsapp" : "sms"
  const sender = from.replace(/^whatsapp:/, "")
  if (
    !providerMessageSid ||
    !/^(SM|MM)[0-9a-f]{32}$/i.test(providerMessageSid) ||
    !/^\+[1-9]\d{7,14}$/.test(sender)
  )
    return null
  const optOutType = params.get("OptOutType")
  const providerReplied =
    optOutType !== null && ["STOP", "START", "HELP"].includes(optOutType)
  return {
    providerMessageSid,
    channel,
    sender,
    keyword: parseInboundKeyword(
      providerReplied ? optOutType : (params.get("Body") ?? "")
    ),
    providerReplied,
  } as const
}

export function inboundTwiml(input: {
  readonly keyword: InboundKeyword
  readonly providerReplied: boolean
}): string {
  if (input.providerReplied) return "<Response/>"
  switch (input.keyword) {
    case "stop":
      return "<Response><Message>Phone messages are switched off. Reply START to switch service messages back on.</Message></Response>"
    case "help":
      return "<Response><Message>Manage your Nabaperks message preferences in your profile. Reply STOP to switch phone messages off.</Message></Response>"
    case "start":
    case "other":
      return "<Response/>"
    default:
      return input.keyword satisfies never
  }
}
