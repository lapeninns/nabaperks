import type { MetadataRoute } from "next"

const iconPurpose = "any" as const
const maskablePurpose = "maskable" as const

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nabaperks",
    short_name: "Nabaperks",
    description:
      "Done-for-you, no-app digital loyalty cards and merchant tools for UK food-led pubs.",
    start_url: "/start",
    scope: "/",
    display: "standalone",
    background_color: "#f6f1e6",
    theme_color: "#cf330a",
    icons: [
      {
        src: "/icons/nabaperks-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: iconPurpose,
      },
      {
        src: "/icons/nabaperks-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: iconPurpose,
      },
      {
        src: "/icons/nabaperks-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: maskablePurpose,
      },
      {
        src: "/icons/nabaperks-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: maskablePurpose,
      },
    ],
    shortcuts: [
      {
        name: "My Nabaperks",
        short_name: "Home",
        description: "Open saved loyalty cards and rewards.",
        url: "/home",
        icons: [{ src: "/icons/nabaperks-icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Scan venue QR",
        short_name: "Scan",
        description: "Scan a Nabaperks venue QR code.",
        url: "/scan",
        icons: [{ src: "/icons/nabaperks-icon-192.png", sizes: "192x192" }],
      },
    ],
  }
}
