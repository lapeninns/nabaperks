"use client"

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from "react"

import {
  consumeRedemptionAction,
  lookupRedemptionAction,
} from "@/app/app/redeem/actions"
import { LookupPanel } from "@/components/merchant/redeem/lookup-panel"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type {
  ConsumeRedemptionResult,
  RedemptionLookup,
} from "@/lib/merchant/redeem"

type ScannerPanelProps = {
  initialToken: string
  initialLookup: RedemptionLookup | null
}

export function ScannerPanel({
  initialToken,
  initialLookup,
}: ScannerPanelProps) {
  const scanElementId = useId().replaceAll(":", "-")
  const lastScannedToken = useRef("")
  const [tokenInput, setTokenInput] = useState(initialToken)
  const [lookup, setLookup] = useState<RedemptionLookup | null>(initialLookup)
  const [consumeResult, setConsumeResult] =
    useState<ConsumeRedemptionResult | null>(null)
  const [cameraStatus, setCameraStatus] = useState(
    "Camera scanner is ready to start."
  )
  const [isPending, startTransition] = useTransition()

  const lookupRaw = useCallback((rawTokenOrUrl: string) => {
    const trimmed = rawTokenOrUrl.trim()
    if (!trimmed) {
      setLookup({
        status: "not_found",
        publicToken: "",
        reason: "Enter or scan a reward QR token.",
      })
      return
    }

    setConsumeResult(null)
    startTransition(() => {
      void lookupRedemptionAction(trimmed).then(setLookup)
    })
  }, [])

  useEffect(() => {
    let mounted = true
    let scanner: InstanceType<
      typeof import("html5-qrcode").Html5QrcodeScanner
    > | null = null

    import("html5-qrcode")
      .then(
        ({
          Html5QrcodeScanner,
          Html5QrcodeScanType,
          Html5QrcodeSupportedFormats,
        }) => {
          if (!mounted) return

          scanner = new Html5QrcodeScanner(
            scanElementId,
            {
              fps: 8,
              qrbox: { width: 240, height: 240 },
              rememberLastUsedCamera: true,
              formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
              supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
            },
            false
          )
          scanner.render(
            (decodedText) => {
              if (decodedText === lastScannedToken.current) return
              lastScannedToken.current = decodedText
              setTokenInput(decodedText)
              setCameraStatus("QR found. Previewing reward.")
              scanner?.pause(true)
              lookupRaw(decodedText)
            },
            () => {
              setCameraStatus(
                "Point the camera at the customer's reward QR or paste the code below."
              )
            }
          )
        }
      )
      .catch(() => {
        if (mounted) {
          setCameraStatus(
            "Camera scanner could not start. Paste the code below."
          )
        }
      })

    return () => {
      mounted = false
      if (scanner) void scanner.clear()
    }
  }, [lookupRaw, scanElementId])

  function handleLookup() {
    lookupRaw(tokenInput)
  }

  function handleConsume() {
    const token =
      lookup?.status === "ready" ? lookup.publicToken : tokenInput.trim()

    if (!token) return

    startTransition(() => {
      void consumeRedemptionAction(token).then(setConsumeResult)
    })
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
      <section className="grid gap-3">
        <div
          id={scanElementId}
          className="min-h-[320px] overflow-hidden rounded-lg border-2 border-dashed bg-background p-3"
        />
        <p className="text-sm leading-6 text-muted-foreground">
          {cameraStatus}
        </p>
      </section>

      <section className="grid content-start gap-4">
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            handleLookup()
          }}
        >
          <label className="grid gap-2 text-sm font-bold">
            Reward QR URL or token
            <Input
              value={tokenInput}
              onChange={(event) => setTokenInput(event.target.value)}
              placeholder="RDM38E5DB51"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Checking..." : "Preview reward"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setTokenInput("")
                setLookup(null)
                setConsumeResult(null)
                lastScannedToken.current = ""
              }}
            >
              Clear
            </Button>
          </div>
        </form>

        <LookupPanel
          lookup={lookup}
          consumeResult={consumeResult}
          pending={isPending}
          onConsume={handleConsume}
        />
      </section>
    </div>
  )
}
