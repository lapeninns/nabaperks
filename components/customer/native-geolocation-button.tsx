"use client"

import { useEffect, useRef } from "react"

import {
  captureFromNativeGeolocationHost,
  type NativeGeolocationHost,
  type StampLocationCapture,
} from "@/lib/customer/stamp-location-capture"

type NativeGeolocationButtonProps = {
  disabled: boolean
  onCapture: (capture: StampLocationCapture) => void
  onBusyChange: (busy: boolean) => void
}

/**
 * Chrome's page-owned location control. A saved deny or quiet-block cannot be
 * cleared by getCurrentPosition; this control can reopen the prompt. Unsupported
 * browsers never mount it.
 */
export function NativeGeolocationButton({
  disabled,
  onCapture,
  onBusyChange,
}: NativeGeolocationButtonProps) {
  const hostRef = useRef<HTMLElement | null>(null)
  const startedAtRef = useRef(0)
  const onCaptureRef = useRef(onCapture)
  const onBusyChangeRef = useRef(onBusyChange)

  useEffect(() => {
    onCaptureRef.current = onCapture
    onBusyChangeRef.current = onBusyChange
  }, [onBusyChange, onCapture])

  useEffect(() => {
    const host = hostRef.current as NativeGeolocationHost | null
    if (!host) return
    host.setAttribute("accuracymode", "precise")

    const start = () => {
      startedAtRef.current =
        typeof performance === "undefined" ? Date.now() : performance.now()
      onBusyChangeRef.current(true)
    }
    const finish = () => {
      onCaptureRef.current(
        captureFromNativeGeolocationHost(host, startedAtRef.current)
      )
      onBusyChangeRef.current(false)
    }
    const dismiss = () => {
      onBusyChangeRef.current(false)
    }

    host.addEventListener("click", start)
    host.addEventListener("location", finish)
    host.addEventListener("promptdismiss", dismiss)
    return () => {
      host.removeEventListener("click", start)
      host.removeEventListener("location", finish)
      host.removeEventListener("promptdismiss", dismiss)
    }
  }, [])

  return (
    <div
      className={disabled ? "pointer-events-none" : undefined}
      data-native-geolocation-wrap
    >
      <geolocation
        ref={hostRef}
        lang="en-GB"
        className="np-geolocation"
        data-native-geolocation=""
        data-use-location=""
      />
    </div>
  )
}

declare module "react" {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      geolocation: React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      >
    }
  }
}
