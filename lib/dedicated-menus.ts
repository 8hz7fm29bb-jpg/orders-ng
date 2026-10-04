export const DEDICATED_MENU_FIELDS = [
  { key: 'celiac_count', label: 'Celiaci' },
  { key: 'vegan_count', label: 'Vegani' },
  { key: 'vegetarian_count', label: 'Vegetariani' },
  { key: 'lactose_free_count', label: 'No lattosio' },
] as const

export type DedicatedMenuKey = typeof DEDICATED_MENU_FIELDS[number]['key']
export type DedicatedMenuCounts = Partial<Record<DedicatedMenuKey, number | null>>

export function dedicatedMenuCount(event: DedicatedMenuCounts, key: DedicatedMenuKey) {
  return Math.max(0, Math.trunc(Number(event[key]) || 0))
}

export function hasDedicatedMenus(event: DedicatedMenuCounts) {
  return DEDICATED_MENU_FIELDS.some(({ key }) => dedicatedMenuCount(event, key) > 0)
}

export function dedicatedMenuTotals(events: DedicatedMenuCounts[]) {
  const totals: Record<DedicatedMenuKey, number> = { celiac_count: 0, vegan_count: 0, vegetarian_count: 0, lactose_free_count: 0 }
  for (const event of events) {
    for (const { key } of DEDICATED_MENU_FIELDS) totals[key] += dedicatedMenuCount(event, key)
  }
  return totals
}
