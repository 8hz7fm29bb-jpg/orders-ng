import type { EventMenuLine } from './supabase'

export type QuoteLine = EventMenuLine & { portion_ratio: number }
export type QuoteTemplate = {
  version: 1; adults: number; baby: number;
  adult_price: number; baby_price: number;
  adult_lines: QuoteLine[]; baby_lines: QuoteLine[];
}

export const roundMenuPrice = (price: number) => Math.max(0, Math.ceil(price * 2 - 1e-9) / 2)
export function menuBase(lines: QuoteLine[]) {
  return roundMenuPrice(lines.reduce((sum, line) => sum + Number(line.sale_price || 0) * line.portion_ratio, 0))
}
export function scaleMenu(lines: QuoteLine[], count: number): QuoteLine[] {
  return lines.map(line => ({ ...line, portions: count, portion_ratio: 1 }))
}
export function quotePrice(lines: QuoteLine[], original: QuoteLine[], originalPrice: number) {
  return Math.max(0, Math.round((originalPrice + menuBase(lines) - menuBase(original)) * 100) / 100)
}
