export const RECIPE_CATEGORIES = [
  'Entrée',
  'Antipasti',
  'Primi',
  'Secondi',
  'Contorni',
  'Dessert',
  'Beverage',
] as const

export type RecipeCategory = typeof RECIPE_CATEGORIES[number]

export function normalizeRecipeCategory(value?: string | null): RecipeCategory | null {
  const v = (value || '').trim().toLowerCase()
  if (!v) return null
  if (v === 'entrée' || v === 'entree') return 'Entrée'
  if (v === 'antipasto' || v === 'antipasti') return 'Antipasti'
  if (v === 'primo' || v === 'primi' || v === 'primi piatti' || v === 'primo piatto') return 'Primi'
  if (v === 'secondo' || v === 'secondi' || v === 'secondi piatti') return 'Secondi'
  if (v === 'contorno' || v === 'contorni') return 'Contorni'
  if (v === 'dessert' || v === 'dolce' || v === 'dolci') return 'Dessert'
  if (v === 'beverage' || v === 'bevande' || v === 'bevanda' || v === 'drink' || v === 'drinks') return 'Beverage'
  return null
}
