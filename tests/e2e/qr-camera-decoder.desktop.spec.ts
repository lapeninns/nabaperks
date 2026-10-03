import { expect, test, type Page } from "@playwright/test"
import QRCode from "qrcode"

import { dismissPwaInstall, HARNESS_ROUTES } from "./helpers/harness"

type CameraFixture = {
  constraints: MediaStreamConstraints[]
  streams: MediaStream[]
  paint: (image: string) => Promise<void>
  release: () => void
}
declare global {
  interface Window {
    qrCameraFixture: CameraFixture
    resumeAnimationFrames: () => void
  }
}

async function installCamera(page: Page, mode: "normal" | "retry" | "pending") {
  const image = await QRCode.toDataURL("https://outside.example/invalid", {
    width: 420,
    margin: 4,
  })
  await page.addInitScript(
    ({ image, mode }) => {
      const canvas = document.createElement("canvas")
      canvas.width = canvas.height = 600
      const context = canvas.getContext("2d")
      if (!context) throw new Error("Test canvas unavailable")
      let currentImage: HTMLImageElement | null = null
      let release = () => {}
      let permitted = mode !== "retry"
      const pending = new Promise<void>((resolve) => {
        release = resolve
      })
      const fixture: CameraFixture = {
        constraints: [],
        streams: [],
        release: () => {
          permitted = true
          release()
        },
        paint: async (source) => {
          const img = new Image()
          img.src = source
          await img.decode()
          currentImage = img
          context.fillStyle = "white"
          context.fillRect(0, 0, 600, 600)
          context.drawImage(img, 90, 90, 420, 420)
        },
      }
      const painted = fixture.paint(image)
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: {
          getUserMedia: async (constraints: MediaStreamConstraints) => {
            fixture.constraints.push(constraints)
            if (!permitted)
              throw new DOMException("Test denied", "NotAllowedError")
            await painted
            if (mode === "pending") await pending
            const stream = canvas.captureStream(10)
            fixture.streams.push(stream)
            await fixture.paint(image)
            const emitFrame = () => {
              if (
                !stream.getTracks().some((track) => track.readyState === "live")
              )
                return
              if (currentImage)
                context.drawImage(currentImage, 90, 90, 420, 420)
              setTimeout(emitFrame, 50)
            }
            setTimeout(emitFrame, 0)
            return stream
          },
        },
      })
      window.qrCameraFixture = fixture
    },
    { image, mode }
  )
}

const token = "11111111-1111-4111-8111-111111111111"
for (const scenario of [
  {
    name: "merchant",
    route: HARNESS_ROUTES.scan,
    invalid: "That is not a reward or discount pass code from a customer",
    retry: "Try again",
    qr: `/r/${token}`,
    destination: `/app/rewards/scan/${token}`,
  },
  {
    name: "customer",
    route: "/scan",
    invalid: "That's not a Nabaperks QR",
    retry: "Try the camera again",
    qr: "/q/completion-camera-fixture",
    destination: "/q/completion-camera-fixture",
  },
]) {
  for (const suspendAnimationFrames of [false, true]) {
    test(`${scenario.name} decodes a real video frame, rejects foreign QR, then stops before routing${suspendAnimationFrames ? " with animation frames suspended" : ""}`, async ({
      page,
    }) => {
      await dismissPwaInstall(page)
      if (suspendAnimationFrames)
        await page.addInitScript(() => {
          const requestAnimationFrame = window.requestAnimationFrame
          window.requestAnimationFrame = () => 0
          window.resumeAnimationFrames = () => {
            window.requestAnimationFrame = requestAnimationFrame
          }
        })
      await installCamera(page, "normal")
      await page.goto(scenario.route)
      await expect
        .poll(() =>
          page
            .locator("video")
            .evaluate(
              (video) =>
                video instanceof HTMLVideoElement &&
                video.readyState >= 2 &&
                video.videoWidth === 600 &&
                video.videoHeight === 600
            )
        )
        .toBe(true)
      await expect(
        page.getByText(scenario.invalid, { exact: true })
      ).toBeVisible()
      if (suspendAnimationFrames)
        await page.evaluate(() => window.resumeAnimationFrames())
      expect(
        await page.evaluate(() => window.qrCameraFixture.constraints[0])
      ).toEqual({
        audio: false,
        video: { facingMode: { ideal: "environment" }, aspectRatio: 1 },
      })
      const destination = page.waitForRequest(
        (request) => new URL(request.url()).pathname === scenario.destination
      )
      const image = await QRCode.toDataURL(scenario.qr, {
        width: 420,
        margin: 4,
      })
      await page.evaluate(async (image) => {
        await window.qrCameraFixture.paint(image)
      }, image)
      await destination
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              window.qrCameraFixture.streams.length > 0 &&
              window.qrCameraFixture.streams.every((stream) =>
                stream
                  .getTracks()
                  .every((track) => track.readyState === "ended")
              )
          )
        )
        .toBe(true)
    })
  }

  test(`${scenario.name} retries permission denial and releases camera synchronously on exit`, async ({
    page,
  }) => {
    await dismissPwaInstall(page)
    await installCamera(page, "retry")
    await page.goto(scenario.route)
    await expect(
      page.getByRole("button", { name: scenario.retry, exact: true })
    ).toBeVisible()
    await page.evaluate(() => window.qrCameraFixture.release())
    await page
      .getByRole("button", { name: scenario.retry, exact: true })
      .click()
    await expect(
      page.getByText(scenario.invalid, { exact: true })
    ).toBeVisible()
    await page
      .getByRole("link", {
        name:
          scenario.name === "merchant" ? "Back to dashboard" : "Back to start",
        exact: true,
      })
      .click()
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            window.qrCameraFixture.streams.length > 0 &&
            window.qrCameraFixture.streams.every((stream) =>
              stream.getTracks().every((track) => track.readyState === "ended")
            )
        )
      )
      .toBe(true)
  })

  test(`${scenario.name} disposes a camera permission result arriving after navigation`, async ({
    page,
  }) => {
    await dismissPwaInstall(page)
    await installCamera(page, "pending")
    await page.goto(scenario.route)
    await expect
      .poll(() =>
        page.evaluate(() => window.qrCameraFixture.constraints.length)
      )
      .toBeGreaterThanOrEqual(1)
    await page
      .getByRole("link", {
        name:
          scenario.name === "merchant" ? "Back to dashboard" : "Back to start",
        exact: true,
      })
      .click()
    await expect(page.locator("video")).toHaveCount(0)
    await page.evaluate(() => window.qrCameraFixture.release())
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            window.qrCameraFixture.streams.length > 0 &&
            window.qrCameraFixture.streams.every((stream) =>
              stream.getTracks().every((track) => track.readyState === "ended")
            )
        )
      )
      .toBe(true)
  })
}
