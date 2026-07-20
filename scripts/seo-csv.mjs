export function parseCsv(source) {
  const rows = []
  let row = []
  let field = ""
  let quoted = false

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    const next = source[index + 1]

    if (character === '"' && quoted && next === '"') {
      field += '"'
      index += 1
    } else if (character === '"') {
      quoted = !quoted
    } else if (character === "," && !quoted) {
      row.push(field)
      field = ""
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1
      row.push(field)
      if (row.some((value) => value.trim() !== "")) rows.push(row)
      row = []
      field = ""
    } else {
      field += character
    }
  }

  if (quoted) throw new Error("CSV contains an unclosed quoted field")
  row.push(field)
  if (row.some((value) => value.trim() !== "")) rows.push(row)
  if (rows.length === 0) return []

  const headers = rows[0].map((value) => value.trim().toLowerCase())
  return rows.slice(1).map((values, rowIndex) => {
    if (values.length !== headers.length) {
      throw new Error(`CSV row ${rowIndex + 2} has the wrong number of columns`)
    }
    return Object.fromEntries(
      headers.map((header, index) => [header, values[index].trim()])
    )
  })
}

export function toCsv(rows, headers) {
  return [
    headers.join(","),
    ...rows.map((row) =>
      headers.map((header) => escapeCsv(row[header] ?? "")).join(",")
    ),
  ].join("\n")
}

function escapeCsv(value) {
  const text = String(value)
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}
