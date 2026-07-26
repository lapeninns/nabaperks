export const dynamic = "force-dynamic"

const CONTROLS_SCRIPT = `
const input = document.getElementById("venueInput")
const venueTexts = [...document.querySelectorAll(".venue-text")]

function updateVenue() {
  const value = input.value.trim() || "Venue name"
  venueTexts.forEach((element) => {
    element.textContent = value
  })
}

input.addEventListener("input", updateVenue)
document.getElementById("cropToggle").addEventListener("change", (event) => {
  document.body.classList.toggle("hide-crops", !event.target.checked)
})
document.getElementById("safeToggle").addEventListener("change", (event) => {
  document.body.classList.toggle("show-safe", event.target.checked)
})
document.getElementById("printBtn").addEventListener("click", () => {
  window.print()
})
`

export function GET() {
  if (process.env.NODE_ENV === "production") {
    return new Response("Not found", { status: 404 })
  }

  return new Response(CONTROLS_SCRIPT, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/javascript; charset=utf-8",
      "X-Robots-Tag": "noindex, nofollow",
    },
  })
}
