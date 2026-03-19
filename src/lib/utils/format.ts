/**
 * Format a number as Thai Baht currency
 * e.g. 1234567.89 → "฿1,234,567.89"
 */
export function formatTHB(amount: number | null | undefined): string {
  if (amount == null) return '—'
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

/**
 * Format a date string as "DD MMM YYYY" (e.g. "15 Mar 2026")
 */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * Format a datetime string as "DD MMM YYYY HH:mm" (e.g. "15 Mar 2026 14:30")
 */
export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Bangkok',
  })
}

/**
 * Format time elapsed since a date as "2d 4h", "45m", "just now"
 */
export function formatTimeElapsed(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m`
  if (hours < 24) return `${hours}h ${minutes % 60}m`
  return `${days}d ${hours % 24}h`
}

/**
 * Calculate gross margin percentage from cost and sale price
 */
export function calcMarginPct(costPrice: number, salePrice: number): number {
  if (salePrice === 0) return 0
  return ((salePrice - costPrice) / salePrice) * 100
}

/**
 * Format a vehicle as "Make Model Year" (e.g. "Kawasaki Z900 2023")
 */
export function formatVehicle(make: string, model: string, year: number): string {
  return `${make} ${model} ${year}`
}
