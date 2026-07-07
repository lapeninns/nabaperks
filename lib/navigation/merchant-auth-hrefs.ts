export function merchantSignupVerifyHref({
  email,
  name,
  next,
}: {
  readonly email: string
  readonly name?: string
  readonly next?: string
}): string {
  const params = new URLSearchParams({ email })
  if (name) params.set("name", name)
  if (next) params.set("next", next)
  return `/signup/verify?${params.toString()}`
}
