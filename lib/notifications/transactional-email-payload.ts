export type TransactionalEmailAttachment = {
  readonly filename: string
  readonly content: string
}

export type TransactionalEmailInput = {
  readonly to: string
  readonly subject: string
  readonly text: string
  readonly html: string
  readonly attachments?: readonly TransactionalEmailAttachment[]
}

export function buildTransactionalEmailPayload(
  from: string,
  { to, subject, text, html, attachments }: TransactionalEmailInput
) {
  return {
    from,
    to: [to],
    subject,
    text,
    html,
    ...(attachments ? { attachments } : {}),
  }
}
