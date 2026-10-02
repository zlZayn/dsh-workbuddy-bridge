/** Display formatting shared by the card's panels. */

/**
 * Compact token count: the catalog's own round numbers (`200000`, `1000000`)
 * read better as `200K` / `1M`, and no precision is lost because these values
 * are always whole thousands.
 */
export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000 && tokens % 1_000_000 === 0) return `${tokens / 1_000_000}M`
  if (tokens >= 1_000 && tokens % 1_000 === 0) return `${tokens / 1_000}K`
  return String(tokens)
}

/** Locale-formatted count. */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat(undefined).format(value)
}

/** Locale-formatted date and time from epoch milliseconds. */
export function formatTime(ms: number): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(ms),
  )
}

/**
 * Locale-formatted cycle-reset time, falling back to the wire string.
 *
 * The host forwards the upstream's own timestamp; when it is not a date this
 * plugin can parse, the raw text is still more useful than nothing.
 */
export function formatCycleReset(time: string): string {
  const parsed = Date.parse(time)
  return Number.isNaN(parsed) ? time : formatTime(parsed)
}

/** Locale-formatted percentage, at most one fraction digit. */
export function formatPercent(percent: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(percent)
}

/**
 * A credit amount, at the precision the ledger actually carries.
 *
 * Credits are recorded to two decimals — the desktop app accumulates stage
 * increments with `Math.round(value * 100) / 100` — so trailing zeros carry no
 * information: `0.50` is `0.5` and `3.00` is `3`. This mirrors that app's own
 * `formatCredit` (integers bare, otherwise two decimals with trailing zeros
 * stripped), so a figure read here matches the one the WorkBuddy client shows
 * for the same request.
 *
 * Deliberately *not* `Intl`-formatted: this is a ledger quantity at a fixed
 * scale, not a locale-sensitive count, and a thousands separator on a balance
 * like `5143` would make it differ from the account's own display.
 */
export function formatCredit(credit: number): string {
  if (!Number.isFinite(credit)) return ''
  if (Number.isInteger(credit)) return String(credit)
  return credit.toFixed(2).replace(/\.?0+$/u, '')
}
