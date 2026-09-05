/** @param {string | undefined} [heapMb] */
export function playwrightServerNodeOptions(heapMb = "8192") {
  if (
    typeof heapMb !== "string" ||
    !/^[1-9]\d{3,4}$/.test(heapMb) ||
    Number(heapMb) < 1024 ||
    Number(heapMb) > 16384
  ) {
    throw new Error(
      "PLAYWRIGHT_NODE_HEAP_MB must be an integer from 1024 to 16384"
    )
  }
  return `--max-old-space-size=${Number(heapMb)}`
}
