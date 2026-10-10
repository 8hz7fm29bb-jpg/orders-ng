/** Shared cost and ingredient expansion for one-level kitchen preparations. */
export type BaseLine = {
  ingredient_id: string; quantity: number; unit_id: string | null; sort_order?: number;
  ingredient?: { id: string; name: string; current_price: number; unit?: { code: string } | null } | null;
  unit?: { code: string } | null;
}
export type Preparation = { id: string; name: string; category: string | null; yield_grams?: number | null; yield_estimated?: boolean; recipe_ingredients?: BaseLine[] }
export type PreparationLink = { preparation_id: string; quantity_grams: number; sort_order?: number; preparation?: Preparation | null }
export type ComposedRecipe = { standard_portions: number; recipe_ingredients?: BaseLine[]; recipe_preparations?: PreparationLink[] }
const factors: Record<string, number> = { g: 1, kg: 1000, ml: 1, l: 1000, pz: 1 }
const families: Record<string, string> = { g: 'mass', kg: 'mass', ml: 'volume', l: 'volume', pz: 'count' }
export function ingredientCost(line: BaseLine) {
  const from = line.unit?.code || line.ingredient?.unit?.code || '';
  const to = line.ingredient?.unit?.code || from;
  const factor = families[from] && families[from] === families[to] ? factors[from] / factors[to] : 1;
  return Number(line.quantity || 0) * factor * Number(line.ingredient?.current_price || 0);
}
export function preparationCost(link: PreparationLink) {
  const prep = link.preparation;
  if (!prep || !(Number(prep.yield_grams) > 0)) return 0;
  return (prep.recipe_ingredients || []).reduce((sum, line) => sum + ingredientCost(line), 0) * Number(link.quantity_grams) / Number(prep.yield_grams);
}
export function composedCost(recipe: ComposedRecipe) {
  return (recipe.recipe_ingredients || []).reduce((sum, line) => sum + ingredientCost(line), 0) +
    (recipe.recipe_preparations || []).reduce((sum, line) => sum + preparationCost(line), 0);
}
export function expandedIngredients(recipe: ComposedRecipe): BaseLine[] {
  return [...(recipe.recipe_ingredients || []), ...(recipe.recipe_preparations || []).flatMap(link => {
    const prep = link.preparation;
    if (!prep || !(Number(prep.yield_grams) > 0)) return [];
    return (prep.recipe_ingredients || []).map(line => ({ ...line, quantity: Number(line.quantity) * Number(link.quantity_grams) / Number(prep.yield_grams) }));
  })];
}
export type PreparationNeed = { preparation: Preparation; quantity_grams: number; uses: { name: string; portions: number; grams: number }[] }
export function preparationNeeds(dishes: { id: string; name: string; quantity: number }[], recipes: Map<string, ComposedRecipe>): PreparationNeed[] {
  const grouped = new Map<string, PreparationNeed>();
  for (const dish of dishes) {
    const recipe = recipes.get(dish.id);
    if (!recipe) continue;
    const portions = Math.max(1, Number(recipe.standard_portions || 1));
    for (const link of recipe.recipe_preparations || []) {
      if (!link.preparation) continue;
      const grams = Number(link.quantity_grams) * dish.quantity / portions;
      if (!(grams > 0)) continue;
      if (!grouped.has(link.preparation_id)) grouped.set(link.preparation_id, { preparation: link.preparation, quantity_grams: 0, uses: [] });
      const row = grouped.get(link.preparation_id)!;
      row.quantity_grams += grams;
      row.uses.push({ name: dish.name, portions: dish.quantity, grams });
    }
  }
  const categories=['Entrée','Antipasti','Primi','Secondi','Contorni','Dessert','Basi neutre'];
  const order=(category?:string|null)=>{const index=categories.indexOf(category||'');return index<0?categories.length:index};
  return Array.from(grouped.values()).sort((a,b)=>order(a.preparation.category)-order(b.preparation.category)||a.preparation.name.localeCompare(b.preparation.name,'it'));
}
