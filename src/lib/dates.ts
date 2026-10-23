const DAY_MS = 86_400_000

/** Local calendar date as YYYY-MM-DD. */
export function todayISO(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function isDateOnly(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = parseISO(value)
  return !Number.isNaN(parsed) && toISO(parsed) === value
}

function parseISO(value: string): number {
  const [year, month, day] = value.split('-').map(Number)
  return Date.UTC(year, month - 1, day)
}

function toISO(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10)
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parseISO(to) - parseISO(from)) / DAY_MS)
}

export function addDays(date: string, days: number): string {
  return toISO(parseISO(date) + Math.round(days) * DAY_MS)
}

export function isFutureDate(value: string, today = todayISO()): boolean {
  return daysBetween(today, value) > 0
}

export function formatDate(value: string, options?: Intl.DateTimeFormatOptions): string {
  const date = new Date(`${value}T12:00:00`)
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    ...options,
  }).format(date)
}

export function formatLongDate(value: string): string {
  const date = new Date(`${value}T12:00:00`)
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

export function relativeDays(days: number): string {
  if (days < 0) {
    const count = Math.abs(days)
    return `Overdue by ${count} ${count === 1 ? 'day' : 'days'}`
  }
  if (days === 0) return 'Due today'
  if (days === 1) return 'Due tomorrow'
  return `In ${days} days`
}

export function shortRelativeDays(days: number): string {
  if (days < 0) return `${Math.abs(days)}d overdue`
  if (days === 0) return 'today'
  return `in ${days}d`
}

export function formatDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

export function daysInclusive(start: string, end: string): number {
  return Math.max(0, daysBetween(start, end))
}
