import assert from "node:assert/strict"
import test from "node:test"
import QRCode from "qrcode"

import { decodeQrFrame } from "../../lib/qr/qr-camera-scanner.ts"

function qrPixels(
  payload,
  { inverted = false, mirrored = false, rotated = false } = {}
) {
  const { modules } = QRCode.create(payload, { errorCorrectionLevel: "M" })
  const width = (modules.size + 8) * 6
  const data = new Uint8ClampedArray(width * width * 4)
  for (let y = 0; y < width; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const px = mirrored ? width - x - 1 : x
      const row = Math.floor((rotated ? px : y) / 6) - 4
      const col = Math.floor((rotated ? width - y - 1 : px) / 6) - 4
      const dark =
        row >= 0 &&
        col >= 0 &&
        row < modules.size &&
        col < modules.size &&
        modules.get(row, col)
      const value = Boolean(dark) !== inverted ? 0 : 255
      const offset = (y * width + x) * 4
      data.set([value, value, value, 255], offset)
    }
  }
  return { data, width, height: width }
}

for (const payload of [
  "/q/disposable-venue-code",
  "/r/11111111-1111-4111-8111-111111111111",
]) {
  for (const [name, options] of Object.entries({
    ordinary: {},
    inverted: { inverted: true },
    mirrored: { mirrored: true },
    rotated: { rotated: true },
  })) {
    test(`decodes actual ${name} RGBA pixels for ${payload}`, () => {
      assert.equal(decodeQrFrame(qrPixels(payload, options)), payload)
    })
  }
}

test("blank and non-QR frame pixels do not fabricate a destination", () => {
  const width = 120
  const white = new Uint8ClampedArray(width * width * 4).fill(255)
  assert.equal(decodeQrFrame({ data: white, width, height: width }), null)
  for (let i = 0; i < white.length; i += 4) {
    const value = (Math.floor(i / 4 / width / 10) % 2) * 255
    white.set([value, value, value, 255], i)
  }
  assert.equal(decodeQrFrame({ data: white, width, height: width }), null)
})
