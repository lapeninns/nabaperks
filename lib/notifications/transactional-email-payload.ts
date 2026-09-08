export type TransactionalEmailAttachment = {
  readonly filename: string
  readonly content: string
}

export type TransactionalEmailInput = {
  readonly to: string
  readonly subject: string
  readonly text: string
  readonly html: string
  readonly replyTo?: string
  readonly headers?: Readonly<Record<string, string>>
  readonly attachments?: readonly TransactionalEmailAttachment[]
  readonly idempotencyKey?: string
}

export function buildTransactionalEmailPayload(
  from: string,
  {
    to,
    subject,
    text,
    html,
    attachments,
    replyTo,
    headers,
  }: TransactionalEmailInput
) {
  return {
    from,
    to: [to],
    subject,
    text,
    html,
    ...(replyTo ? { reply_to: replyTo } : {}),
    ...(headers ? { headers } : {}),
    ...(attachments ? { attachments } : {}),
  }
}
