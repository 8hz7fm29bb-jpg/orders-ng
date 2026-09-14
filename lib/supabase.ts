import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

export const configured = Boolean(url && key)

export const supabase = configured
  ? createClient(url!, key!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null

export type MenuRecipeOption = {
  id: string
  name: string
  category: string | null
  active: boolean
}

export type EventMenuLine = {
  recipe_id: string
  course_type: string
}

async function eventIdFromNumber(eventNumber: number) {
  if (!supabase) return { id: null as string | null, error: 'Supabase non disponibile' }
  const res = await supabase.from('events').select('id').eq('event_number', eventNumber).single()
  if (res.error) return { id: null, error: res.error.message }
  return { id: res.data.id as string, error: null as string | null }
}

export async function loadEventMenuByNumber(eventNumber: number) {
  if (!supabase) return { eventId:null, menuId:null, recipes:[] as MenuRecipeOption[], lines:[] as EventMenuLine[], error:'Supabase non disponibile' }

  const eventRes = await eventIdFromNumber(eventNumber)
  if (!eventRes.id) return { eventId:null, menuId:null, recipes:[] as MenuRecipeOption[], lines:[] as EventMenuLine[], error:eventRes.error }

  const recipesRes = await supabase.from('recipes').select('id,name,category,active').eq('active', true).order('name')
  if (recipesRes.error) return { eventId:eventRes.id, menuId:null, recipes:[] as MenuRecipeOption[], lines:[] as EventMenuLine[], error:recipesRes.error.message }

  const menuRes = await supabase.from('event_menus').select('*').eq('event_id', eventRes.id).limit(1).maybeSingle()
  if (menuRes.error) return { eventId:eventRes.id, menuId:null, recipes:recipesRes.data as MenuRecipeOption[], lines:[] as EventMenuLine[], error:menuRes.error.message }
  if (!menuRes.data) return { eventId:eventRes.id, menuId:null, recipes:recipesRes.data as MenuRecipeOption[], lines:[] as EventMenuLine[], error:null }

  const itemsRes = await supabase.from('event_menu_items').select('*').eq('event_menu_id', menuRes.data.id).order('sort_order', { ascending:true })
  if (itemsRes.error) return { eventId:eventRes.id, menuId:menuRes.data.id as string, recipes:recipesRes.data as MenuRecipeOption[], lines:[] as EventMenuLine[], error:itemsRes.error.message }

  return {
    eventId:eventRes.id,
    menuId:menuRes.data.id as string,
    recipes:recipesRes.data as MenuRecipeOption[],
    lines:(itemsRes.data || []).map((x:any) => ({ recipe_id:x.recipe_id || '', course_type:x.course_type || 'other' })),
    error:null,
  }
}

export async function saveEventMenuByNumber(eventNumber: number, menuId: string | null, lines: EventMenuLine[], recipes: MenuRecipeOption[]) {
  if (!supabase) return { menuId:null as string | null, error:'Supabase non disponibile' }

  const eventRes = await eventIdFromNumber(eventNumber)
  if (!eventRes.id) return { menuId:null, error:eventRes.error }

  let id = menuId
  if (!id) {
    let created:any = await supabase.from('event_menus').insert({ event_id:eventRes.id, name:'Menu principale' }).select('id').single()
    if (created.error && String(created.error.message || '').includes('price_cents')) {
      created = await supabase.from('event_menus').insert({ event_id:eventRes.id, name:'Menu principale', description:null, price_cents:0, currency:'EUR', is_active:true }).select('id').single()
    }
    if (created.error) return { menuId:null, error:created.error.message }
    id = created.data.id as string
  }

  const del = await supabase.from('event_menu_items').delete().eq('event_menu_id', id)
  if (del.error) return { menuId:id, error:del.error.message }

  if (lines.length) {
    let rows:any[] = lines.map((line, index) => ({
      event_menu_id:id,
      recipe_id:line.recipe_id,
      course_type:line.course_type,
      sort_order:index,
    }))

    let ins:any = await supabase.from('event_menu_items').insert(rows)
    if (ins.error && (String(ins.error.message || '').includes('name') || String(ins.error.message || '').includes('price_cents'))) {
      rows = lines.map((line, index) => ({
        event_menu_id:id,
        recipe_id:line.recipe_id,
        course_type:line.course_type,
        sort_order:index,
        name:recipes.find(r => r.id === line.recipe_id)?.name || 'Portata',
        description:null,
        price_cents:0,
        is_active:true,
      }))
      ins = await supabase.from('event_menu_items').insert(rows)
    }
    if (ins.error) return { menuId:id, error:ins.error.message }
  }

  return { menuId:id, error:null as string | null }
}
