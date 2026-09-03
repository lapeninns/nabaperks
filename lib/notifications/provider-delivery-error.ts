/** A provider explicitly rejected the request before accepting delivery. */
export class DefinitiveProviderRejectionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "DefinitiveProviderRejectionError"
  }
}

export function isDefinitiveProviderRejection(
  error: unknown
): error is DefinitiveProviderRejectionError {
  return error instanceof DefinitiveProviderRejectionError
}
