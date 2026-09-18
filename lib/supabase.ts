import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

export const configured = Boolean(url && key)
export const supabase = configured ? createClient(url!, key!, { auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true} }) : null

export type MenuRecipeOption={id:string;name:string;category:string|null;active:boolean;sale_price:number}
export type EventMenuLine={recipe_id:string;course_type:string;sale_price?:number}

async function eventIdFromNumber(eventNumber:number){if(!supabase)return{id:null as string|null,error:'Supabase non disponibile'};const res=await supabase.from('events').select('id').eq('event_number',eventNumber).single();if(res.error)return{id:null,error:res.error.message};return{id:res.data.id as string,error:null as string|null}}

async function loadRecipes():Promise<{recipes:MenuRecipeOption[],error:string|null}>{
 if(!supabase)return{recipes:[],error:'Supabase non disponibile'}
 const rr=await supabase.from('recipes').select('id,name,category,active,target_food_cost_percent,manual_sale_price,standard_portions').eq('active',true).order('name')
 if(rr.error)return{recipes:[],error:rr.error.message}
 const ir=await supabase.from('recipe_ingredients').select('recipe_id,quantity,unit:units(code),ingredient:ingredients(current_price,unit:units(code))')
 if(ir.error)return{recipes:[],error:ir.error.message}
 const costs=new Map<string,number>()
 for(const x of (ir.data||[]) as any[]){const q=Number(x.quantity||0),p=Number(x.ingredient?.current_price||0),from=x.unit?.code,to=x.ingredient?.unit?.code;let factor=1;if(from==='g'&&to==='kg')factor=.001;else if(from==='ml'&&to==='l')factor=.001;else if(from==='kg'&&to==='g')factor=1000;else if(from==='l'&&to==='ml')factor=1000;costs.set(x.recipe_id,(costs.get(x.recipe_id)||0)+(q*factor*p))}
 return{recipes:(rr.data||[]).map((r:any)=>{const portions=Math.max(Number(r.standard_portions||1),1),foodCost=(costs.get(r.id)||0)/portions,target=Number(r.target_food_cost_percent||0),manual=r.manual_sale_price==null?null:Number(r.manual_sale_price);return{id:r.id,name:r.name,category:r.category,active:r.active,sale_price:manual??(target>0?foodCost/(target/100):0)}}),error:null}
}

export async function loadEventMenuByNumber(eventNumber:number){
 if(!supabase)return{eventId:null,menuId:null,recipes:[] as MenuRecipeOption[],lines:[] as EventMenuLine[],error:'Supabase non disponibile'}
 const eventRes=await eventIdFromNumber(eventNumber);if(!eventRes.id)return{eventId:null,menuId:null,recipes:[],lines:[],error:eventRes.error}
 const loaded=await loadRecipes();if(loaded.error)return{eventId:eventRes.id,menuId:null,recipes:[],lines:[],error:loaded.error}
 const menuRes=await supabase.from('event_menus').select('*').eq('event_id',eventRes.id).eq('active',true).limit(1).maybeSingle();if(menuRes.error)return{eventId:eventRes.id,menuId:null,recipes:loaded.recipes,lines:[],error:menuRes.error.message};if(!menuRes.data)return{eventId:eventRes.id,menuId:null,recipes:loaded.recipes,lines:[],error:null}
 const itemsRes=await supabase.from('event_menu_items').select('*').eq('menu_id',menuRes.data.id).order('sort_order',{ascending:true});if(itemsRes.error)return{eventId:eventRes.id,menuId:menuRes.data.id as string,recipes:loaded.recipes,lines:[],error:itemsRes.error.message}
 return{eventId:eventRes.id,menuId:menuRes.data.id as string,recipes:loaded.recipes,lines:(itemsRes.data||[]).map((x:any)=>({recipe_id:x.recipe_id||'',course_type:loaded.recipes.find(r=>r.id===x.recipe_id)?.category||'other',sale_price:x.sale_price==null?undefined:Number(x.sale_price)})),error:null}
}

export async function saveEventMenuByNumber(eventNumber:number,menuId:string|null,lines:EventMenuLine[],recipes:MenuRecipeOption[]){
 if(!supabase)return{menuId:null as string|null,error:'Supabase non disponibile'}
 const eventRes=await eventIdFromNumber(eventNumber);if(!eventRes.id)return{menuId:null,error:eventRes.error}
 let id=menuId
 if(!id){const created=await supabase.from('event_menus').insert({event_id:eventRes.id,name:'Menu principale',active:true}).select('id').single();if(created.error)return{menuId:null,error:created.error.message};id=created.data.id as string}
 const del=await supabase.from('event_menu_items').delete().eq('menu_id',id);if(del.error)return{menuId:id,error:del.error.message}
 if(lines.length){const rows=lines.map((line,index)=>{const r=recipes.find(x=>x.id===line.recipe_id);return{menu_id:id,recipe_id:line.recipe_id,course_type:r?.category||'other',display_name:r?.name||'Portata',portions:1,sale_price:r?.sale_price||0,sort_order:index,customer_visible:true}});const ins=await supabase.from('event_menu_items').insert(rows);if(ins.error)return{menuId:id,error:ins.error.message}}
 return{menuId:id,error:null as string|null}
}
