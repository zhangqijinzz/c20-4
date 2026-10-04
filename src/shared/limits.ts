export function clampDeskSize(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.min(4000, Math.max(600, Math.round(value)))
}

export function clampItemDimension(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.min(2000, Math.max(40, Math.round(value)))
}
