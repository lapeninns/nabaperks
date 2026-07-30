export const GOOGLE_REVIEW_PLATE_LAYOUT_MM = {
  badgeCentreOffset: 3.5,
  starsY: 39.5,
  button: {
    x: 15,
    y: 27.2,
    width: 70,
    height: 11,
  },
  fallbackCaption: {
    x: 14,
    width: 37,
    firstY: 16,
  },
  // QR size deliberately absent: both render paths take it from the design
  // geometry (googleReviewQrOuterMm), never from this positional layout.
  qr: {
    x: 58,
    y: 1.5,
    framePadding: 0.8,
  },
} as const
