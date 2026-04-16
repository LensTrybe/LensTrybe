/** Display budget/quote with a leading $ if missing. */
export function formatJobBudget(value) {
  if (value == null) return ''
  const t = String(value).trim()
  if (!t) return ''
  return t.startsWith('$') ? t : `$${t}`
}

/** Value for an input that shows a separate $ prefix (strip leading $). */
export function budgetInputValueFromStored(value) {
  const t = String(value ?? '').trim()
  if (!t) return ''
  return t.startsWith('$') ? t.slice(1).trim() : t
}

/** Persist budget from input that omits the visible $ prefix. */
export function budgetStoredFromInput(inputValue) {
  const t = String(inputValue ?? '').trim()
  if (!t) return null
  return t.startsWith('$') ? t : `$${t}`
}
