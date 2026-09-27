/** A trimmed string form field, or "" when absent or not a string. */
export function formValue(formData: FormData, key: string): string {
  const raw = formData.get(key)
  return typeof raw === "string" ? raw.trim() : ""
}
