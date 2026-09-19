'use client'

import { useEffect,useMemo,useState } from 'react'
import { Plus,Trash2 } from 'lucide-react'
import { EventMenuLine,MenuRecipeOption,loadEventMenuByNumber,saveEventMenuByNumber,supabase } from '@/lib/supabase'

const euro=(n:number)=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(n)
type Audience='adult'|'baby'

export function EventMenuEditor({eventNumber}:{eventNumber:number}){
 const[recipes,setRecipes]=useState<MenuRecipeOption[]>([])
 const[adultMenuId,setAdultMenuId]=useState<string|null>(null),[babyMenuId,setBabyMenuId]=useState<string|null>(null)
 const[adultLines,setAdultLines]=useState<EventMenuLine[]>([]),[babyLines,setBabyLines]=useState<EventMenuLine[]>([])
 const[adults,setAdults]=useState(0),[baby,setBaby]=useState(0)
 const[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[message,setMessage]=useState('')
 useEffect(()=>{let cancelled=false;(async()=>{setLoading(true);setMessage('');if(supabase){const ev=await supabase.from('events').select('adults,baby').eq('event_number',eventNumber).single();if(ev.data){setAdults(Number(ev.data.adults||0));setBaby(Number(ev.data.baby||0))}}
 const [a,b]=await Promise.all([loadEventMenuByNumber(eventNumber,'adult'),loadEventMenuByNumber(eventNumber,'baby')]);if(cancelled)return
 setAdultMenuId(a.menuId);setBabyMenuId(b.menuId);setRecipes(a.recipes.length?a.recipes:b.recipes)
 setAdultLines(a.lines.map(l=>({...l,portions:Number(l.portions||0)>1?Number(l.portions):Number(adults||0)})))
 setBabyLines(b.lines.map(l=>({...l,portions:Number(l.portions||0)>0?Number(l.portions):Number(baby||0)})))
 if(a.error||b.error)setMessage(a.error||b.error||'');setLoading(false)})();return()=>{cancelled=true}},[eventNumber])
 const adultTotal=useMemo(()=>adultLines.reduce((sum,l)=>sum+(recipes.find(r=>r.id===l.recipe_id)?.sale_price||l.sale_price||0),0),[adultLines,recipes])
 function linesFor(a:Audience){return a==='adult'?adultLines:babyLines}
 function setFor(a:Audience,v:EventMenuLine[]){a==='adult'?setAdultLines(v):setBabyLines(v)}
 function defaultPortions(a:Audience){return a==='adult'?adults:baby}
 function addLine(a:Audience){setFor(a,[...linesFor(a),{recipe_id:'',course_type:'other',portions:defaultPortions(a)}])}
 function updateLine(a:Audience,index:number,patch:Partial<EventMenuLine>){setFor(a,linesFor(a).map((line,i)=>i===index?{...line,...patch}:line))}
 function removeLine(a:Audience,index:number){setFor(a,linesFor(a).filter((_,i)=>i!==index))}
 function moveLine(a:Audience,index:number,direction:-1|1){const v=linesFor(a);const target=index+direction;if(target<0||target>=v.length)return;const copy=[...v];[copy[index],copy[target]]=[copy[target],copy[index]];setFor(a,copy)}
 async function save(){if([...adultLines,...babyLines].some(l=>!l.recipe_id)){setMessage('Seleziona una ricetta per ogni portata.');return}setSaving(true);setMessage('')
 const a=await saveEventMenuByNumber(eventNumber,adultMenuId,adultLines,recipes,'adult');if(a.error){setSaving(false);setMessage(a.error);return}setAdultMenuId(a.menuId)
 if(baby>0||babyLines.length){const b=await saveEventMenuByNumber(eventNumber,babyMenuId,babyLines,recipes,'baby');if(b.error){setSaving(false);setMessage(b.error);return}setBabyMenuId(b.menuId)}
 if(supabase){const ev=await supabase.from('events').select('id,price_adjustment').eq('event_number',eventNumber).single();if(ev.data)await supabase.from('events').update({price_per_adult:adultTotal+Number(ev.data.price_adjustment||0)}).eq('id',ev.data.id)}
 setSaving(false);setMessage('Menu salvato.')}
 useEffect(()=>{const handler=()=>{void save()};window.addEventListener('orders-ng-save-menu',handler);return()=>window.removeEventListener('orders-ng-save-menu',handler)},[adultLines,babyLines,recipes,adultMenuId,babyMenuId,adultTotal,eventNumber,baby])
 function block(a:Audience,title:string,count:number){const lines=linesFor(a);return <section className="compositionBox eventMenuBlock"><div className="compositionHead"><div><span className="eyebrow">{title}</span><h3>Portate <small className="menuGuestCount">· {count} ospiti</small></h3></div><button type="button" className="secondary" onClick={()=>addLine(a)}><Plus size={16}/> Aggiungi portata</button></div>{lines.length===0?<div className="empty">Nessuna portata. Aggiungi la prima ricetta al menu.</div>:<div className="eventMenuLines"><div className="eventMenuLine eventMenuHeader"><span>Ricetta</span><span>Categoria</span><span>Porzioni</span><span>Prezzo</span><span></span></div>{lines.map((line,idx)=>{const recipe=recipes.find(r=>r.id===line.recipe_id);const price=recipe?.sale_price||line.sale_price||0;return <div key={idx} className="eventMenuLine"><select value={line.recipe_id} onChange={e=>{const selected=recipes.find(r=>r.id===e.target.value);updateLine(a,idx,{recipe_id:e.target.value,course_type:selected?.category||'other',sale_price:selected?.sale_price||0})}}><option value="">Seleziona ricetta</option>{recipes.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select><strong>{recipe?.category||'—'}</strong><input className="menuPortionsInput" type="number" min="0" step="1" value={line.portions??count} onChange={e=>updateLine(a,idx,{portions:Number(e.target.value)})}/><strong className="menuPrice">{line.recipe_id?euro(price):'—'}</strong><div className="menuLineActions"><button type="button" className="ghost" onClick={()=>moveLine(a,idx,-1)} disabled={idx===0}>↑</button><button type="button" className="ghost" onClick={()=>moveLine(a,idx,1)} disabled={idx===lines.length-1}>↓</button><button type="button" className="deleteLine" onClick={()=>removeLine(a,idx)}><Trash2 size={16}/></button></div></div>})}</div>}<small className="fieldHint">Le porzioni partono da {count} ma possono essere modificate per ogni singola portata.</small></section>}
 return <div className="eventMenusWrap">{loading?<div className="empty">Caricamento menu…</div>:<>{block('adult','MENU ADULTI',adults)}{baby>0&&block('baby','MENU BABY',baby)}</>}{message&&<div className={message==='Menu salvato.'?'fieldHint':'errorBox'}>{message}</div>}</div>
}
