type ReviewMarkProps = {
  readonly className?: string
}

export function GoogleGMark({ className }: ReviewMarkProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      role="img"
      aria-label="Google"
    >
      <path
        fill="#4285f4"
        d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z"
      />
      <path
        fill="#34a853"
        d="M12 22c2.7 0 4.97-.9 6.62-2.36l-3.24-2.54c-.9.6-2.05.96-3.38.96-2.6 0-4.81-1.76-5.6-4.13H3.05v2.62A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#fbbc05"
        d="M6.4 13.93A6.02 6.02 0 0 1 6.08 12c0-.67.12-1.32.32-1.93V7.45H3.05A10 10 0 0 0 2 12c0 1.62.39 3.15 1.05 4.55l3.35-2.62Z"
      />
      <path
        fill="#ea4335"
        d="M12 5.94c1.47 0 2.78.5 3.82 1.5l2.86-2.87A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.95 5.45l3.35 2.62C7.19 7.7 9.4 5.94 12 5.94Z"
      />
    </svg>
  )
}

export function ReviewStars({ className }: ReviewMarkProps) {
  return (
    <span className={className} aria-label="Five stars">
      {Array.from({ length: 5 }, (_, index) => (
        <svg key={index} viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="m12 2.1 2.98 6.03 6.66.97-4.82 4.69 1.14 6.63L12 17.29l-5.96 3.13 1.14-6.63L2.36 9.1l6.66-.97L12 2.1Z"
            fill="#fbbc05"
            stroke="#f9ab00"
            strokeWidth="1"
            strokeLinejoin="round"
          />
        </svg>
      ))}
    </span>
  )
}

export function NfcTapMark({ className }: ReviewMarkProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M6 8.5a7 7 0 0 1 0 7" />
      <path d="M10 5.5a12 12 0 0 1 0 13" />
      <circle cx="3.2" cy="12" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  )
}
