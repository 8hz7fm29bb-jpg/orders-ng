export const RECIPE_CATEGORIES = [
  'Entrée',
  'Antipasti',
  'Primi piatti',
  'Secondi',
  'Contorni',
  'Dessert',
] as const

export type RecipeCategory = typeof RECIPE_CATEGORIES[number]

export function normalizeRecipeCategory(value?: string | null): RecipeCategory | null {
  const v = (value || '').trim().toLowerCase()
  if (!v) return null
  if (v === 'entrée' || v === 'entree') return 'Entrée'
  if (v === 'antipasto' || v === 'antipasti') return 'Antipasti'
  if (v === 'primo' || v === 'primi' || v === 'primi piatti') return 'Primi piatti'
  if (v === 'secondo' || v === 'secondi') return 'Secondi'
  if (v === 'contorno' || v === 'contorni') return 'Contorni'
  if (v === 'dessert' || v === 'dolce' || v === 'dolci') return 'Dessert'
  return null
}
