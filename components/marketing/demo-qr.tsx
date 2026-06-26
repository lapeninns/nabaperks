const qrCells = [
  1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 1, 1, 0,
  1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 1,
  0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 1,
  0, 1, 1, 0, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 0, 0, 1, 1, 0, 1, 1,
]

export function DemoQr({ className }: { className?: string }) {
  return (
    <div
      className={
        className ??
        "grid aspect-square w-16 grid-cols-10 gap-[2px] rounded-sm bg-white p-1"
      }
    >
      {qrCells.map((cell, index) => (
        <span
          key={index}
          className={cell ? "rounded-[1px] bg-qr" : "bg-transparent"}
        />
      ))}
    </div>
  )
}
