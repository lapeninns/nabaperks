import { QrFrame } from "nabaperks"

/** A lightweight faux QR matrix so the frame has a realistic scan target without
 *  pulling a QR library into the preview. */
const QrMatrix = () => (
  <svg
    viewBox="0 0 25 25"
    role="img"
    aria-label="Counter QR code"
    className="size-40"
    shapeRendering="crispEdges"
  >
    <rect width="25" height="25" fill="#fff" />
    <g fill="#000">
      <path d="M0 0h7v7H0zM2 2h3v3H2zM18 0h7v7h-7zM20 2h3v3h-3zM0 18h7v7H0zM2 20h3v3H2z" />
      <path d="M9 0h1v2H9zM11 1h2v1h-2zM14 0h1v3h-1zM10 3h1v2h-1zM12 3h3v1h-3zM9 5h4v1H9z" />
      <path d="M0 9h2v1H0zM3 9h1v3H3zM5 9h1v1H5zM1 11h2v1H1zM0 13h3v1H0zM4 13h2v2H4z" />
      <path d="M9 9h2v2H9zM12 9h1v1h-1zM14 9h1v2h-1zM11 11h3v1h-3zM9 12h1v3H9zM13 13h2v2h-2z" />
      <path d="M16 9h1v3h-1zM18 9h3v1h-3zM22 9h2v1h-2zM17 11h2v1h-2zM20 11h1v3h-1zM23 12h2v2h-2z" />
      <path d="M9 16h2v1H9zM12 16h3v1h-3zM16 16h3v2h-3zM20 16h1v3h-1zM22 16h2v1h-2zM23 18h2v2h-2z" />
      <path d="M9 20h1v3H9zM11 20h3v1h-3zM13 22h2v2h-2zM16 21h3v1h-3zM20 22h4v1h-4z" />
    </g>
  </svg>
)

export const Default = () => (
  <div className="max-w-xs">
    <QrFrame>
      <QrMatrix />
    </QrFrame>
  </div>
)

export const Labelled = () => (
  <div className="max-w-xs">
    <QrFrame label="Scan at the Bridge Street Coffee counter">
      <QrMatrix />
    </QrFrame>
  </div>
)
