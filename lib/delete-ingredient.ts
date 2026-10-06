import { supabase } from '@/lib/supabase'

export async function deleteIngredient(id:string,name:string,confirmDelete:(message:string)=>boolean=window.confirm.bind(window)){
 if(!supabase)throw new Error('Database non disponibile.')
 const [recipes,mappings]=await Promise.all([
  supabase.from('recipe_ingredients').select('recipe:recipes(name)').eq('ingredient_id',id),
  supabase.from('rch_mappings').select('rch_id').eq('ingredient_id',id)
 ])
 if(recipes.error)throw new Error(recipes.error.message)
 if(mappings.error)throw new Error(mappings.error.message)
 const recipeNames=[...new Set((recipes.data||[]).map((r:any)=>r.recipe?.name||'Ricetta'))]
 if(recipeNames.length)throw new Error(`Impossibile eliminare “${name}”: è utilizzato in ${recipeNames.join(', ')}. Sostituisci o rimuovi prima l’ingrediente da queste ricette.`)
 const mappingCount=mappings.data?.length||0
 if(!confirmDelete(`Eliminare definitivamente “${name}” e il suo storico prezzi?${mappingCount?` Le ${mappingCount} associazioni RCH collegate torneranno “Da associare”.`:''} I resoconti RCH già importati conserveranno i dati salvati.`))return false
 const result=await supabase.from('ingredients').delete().eq('id',id).select('id').single()
 if(result.error)throw new Error(result.error.code==='23503'?'L’ingrediente è ora collegato a una ricetta e non può essere eliminato. Aggiorna la pagina e controlla le ricette.':result.error.message)
 return true
}
