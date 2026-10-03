import jsQR from "jsqr"

export function decodeQrFrame(frame: ImageData): string | null {
  return (
    jsQR(frame.data, frame.width, frame.height, {
      inversionAttempts: "attemptBoth",
    })?.data ?? null
  )
}

export function createQrCameraScanner(
  target: HTMLElement,
  onDecode: (text: string) => void,
  onError: (error: unknown) => void
) {
  let stopped = false
  let stream: MediaStream | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  const video = document.createElement("video")
  video.autoplay = true
  video.muted = true
  video.playsInline = true
  video.setAttribute("aria-hidden", "true")
  const canvas = document.createElement("canvas")
  const context = canvas.getContext("2d", { willReadFrequently: true })

  function stop() {
    stopped = true
    if (timer !== null) clearTimeout(timer)
    for (const track of stream?.getTracks() ?? []) track.stop()
    video.pause()
    video.srcObject = null
    video.remove()
  }

  function scan() {
    if (stopped) return
    try {
      if (context && video.readyState >= 2) {
        const sourceEdge = Math.min(video.videoWidth, video.videoHeight)
        const edge = Math.min(720, sourceEdge)
        if (edge > 0) {
          if (canvas.width !== edge) canvas.width = canvas.height = edge
          context.drawImage(
            video,
            (video.videoWidth - sourceEdge) / 2,
            (video.videoHeight - sourceEdge) / 2,
            sourceEdge,
            sourceEdge,
            0,
            0,
            edge,
            edge
          )
          const decoded = decodeQrFrame(context.getImageData(0, 0, edge, edge))
          if (decoded !== null && !stopped) onDecode(decoded)
        }
      }
    } catch (error) {
      stop()
      onError(error)
      return
    }
    if (!stopped) timer = setTimeout(scan, 100)
  }

  async function start(): Promise<void> {
    try {
      if (!context || !navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera unavailable")
      }
      const openedStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" }, aspectRatio: 1 },
      })
      if (stopped) {
        for (const track of openedStream.getTracks()) track.stop()
        return
      }
      stream = openedStream
      video.srcObject = stream
      target.append(video)
      // WebKit can suspend a muted stream before the new viewfinder is laid out.
      video.getBoundingClientRect()
      await video.play()
      if (!stopped) timer = setTimeout(scan, 100)
    } catch (error) {
      stop()
      throw error
    }
  }

  return { start, stop }
}
