'use client'

import { useEffect,useMemo,useState,useRef } from 'react'
import type { EventPdfRequest } from '@/lib/event-pdf'
import { createPortal } from 'react-dom'
import { Plus,Trash2 } from 'lucide-react'
import { EventMenuLine,MenuRecipeOption,loadEventMenuByNumber,saveEventMenuByNumber,supabase } from '@/lib/supabase'

const euro=(n:number)=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(n)
type Audience='adult'|'baby'

export function EventMenuEditor({eventNumber}:{eventNumber:number}){
 const[pdfPreview,setPdfPreview]=useState<{url:string;filename:string}|null>(null)
 const pdfUrl=useRef<string|null>(null)
 const previewClose=useRef<HTMLButtonElement|null>(null)
 const returnFocus=useRef<HTMLElement|null>(null)
 function closePdf(){if(pdfUrl.current)URL.revokeObjectURL(pdfUrl.current);pdfUrl.current=null;setPdfPreview(null);returnFocus.current?.focus()}
 useEffect(()=>{if(!pdfPreview)return;previewClose.current?.focus();const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.stopPropagation();closePdf()}};window.addEventListener('keydown',escape,true);return()=>window.removeEventListener('keydown',escape,true)},[pdfPreview])
 useEffect(()=>()=>{if(pdfUrl.current)URL.revokeObjectURL(pdfUrl.current)},[])
 const[recipes,setRecipes]=useState<MenuRecipeOption[]>([])
 const[adultMenuId,setAdultMenuId]=useState<string|null>(null),[babyMenuId,setBabyMenuId]=useState<string|null>(null)
 const[adultLines,setAdultLines]=useState<EventMenuLine[]>([]),[babyLines,setBabyLines]=useState<EventMenuLine[]>([])
 const[adults,setAdults]=useState(0),[baby,setBaby]=useState(0)
 const[loadError,setLoadError]=useState('')
 const[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[message,setMessage]=useState('')
 useEffect(()=>{let cancelled=false;(async()=>{setLoading(true);setLoadError('');setMessage('');let adultCount=0,babyCount=0;if(supabase){const ev=await supabase.from('events').select('adults,baby').eq('event_number',eventNumber).single();if(ev.data){adultCount=Number(ev.data.adults||0);babyCount=Number(ev.data.baby||0);setAdults(adultCount);setBaby(babyCount)}}
 const [a,b]=await Promise.all([loadEventMenuByNumber(eventNumber,'adult'),loadEventMenuByNumber(eventNumber,'baby')]);if(cancelled)return
 setAdultMenuId(a.menuId);setBabyMenuId(b.menuId);setRecipes(a.recipes.length?a.recipes:b.recipes)
 setAdultLines(a.lines.map(l=>({...l,portions:l.portions??adultCount})))
 setBabyLines(b.lines.map(l=>({...l,portions:l.portions??babyCount})))
 if(a.error||b.error){setLoadError(a.error||b.error||'');setMessage(a.error||b.error||'')}setLoading(false)})();return()=>{cancelled=true}},[eventNumber])
 const roundUpHalfEuro=(price:number)=>Math.max(0,Math.ceil(price*2-1e-9)/2)
 const priceFor=(lines:EventMenuLine[],count:number)=>count>0?lines.reduce((sum,l)=>sum+(recipes.find(r=>r.id===l.recipe_id)?.sale_price??l.sale_price??0)*Number(l.portions??count),0)/count:0
 const adultTotal=useMemo(()=>roundUpHalfEuro(priceFor(adultLines,adults)),[adultLines,recipes,adults])
 const babyTotal=useMemo(()=>roundUpHalfEuro(priceFor(babyLines,baby)),[babyLines,recipes,baby])
 useEffect(()=>{if(!loading&&!loadError)window.dispatchEvent(new CustomEvent('orders-ng-menu-prices',{detail:{adult:adultTotal,baby:babyTotal}}))},[adultTotal,babyTotal,loading,loadError])
 function linesFor(a:Audience){return a==='adult'?adultLines:babyLines}
 function setFor(a:Audience,v:EventMenuLine[]){a==='adult'?setAdultLines(v):setBabyLines(v)}
 function defaultPortions(a:Audience){return a==='adult'?adults:baby}
 function addLine(a:Audience){setFor(a,[...linesFor(a),{recipe_id:'',course_type:'other',portions:defaultPortions(a)}])}
 function updateLine(a:Audience,index:number,patch:Partial<EventMenuLine>){setFor(a,linesFor(a).map((line,i)=>i===index?{...line,...patch}:line))}
 function removeLine(a:Audience,index:number){setFor(a,linesFor(a).filter((_,i)=>i!==index))}
 function moveLine(a:Audience,index:number,direction:-1|1){const v=linesFor(a);const target=index+direction;if(target<0||target>=v.length)return;const copy=[...v];[copy[index],copy[target]]=[copy[target],copy[index]];setFor(a,copy)}
 async function save(){if(loadError){setMessage(loadError);return false}if(loading||saving){setMessage('Attendi il caricamento o il salvataggio del menu.');return false}if([...adultLines,...babyLines].some(l=>!l.recipe_id&&!l.display_name?.trim())){setMessage('Seleziona una ricetta per ogni portata.');return false}setSaving(true);setMessage('')
 const a=await saveEventMenuByNumber(eventNumber,adultMenuId,adultLines,recipes,'adult');if(a.error){setSaving(false);setMessage(a.error);return false}setAdultMenuId(a.menuId)
 if(baby>0||babyLines.length){const b=await saveEventMenuByNumber(eventNumber,babyMenuId,babyLines,recipes,'baby');if(b.error){setSaving(false);setMessage(b.error);return false}setBabyMenuId(b.menuId)}
 setSaving(false);setMessage('Menu salvato.');return true}
 useEffect(()=>{const sync=(e:Event)=>{const d=(e as CustomEvent<{adults:number;baby:number}>).detail;if(!d)return;setAdults(Number(d.adults||0));setBaby(Number(d.baby||0))};window.addEventListener('orders-ng-guest-counts',sync as EventListener);return()=>window.removeEventListener('orders-ng-guest-counts',sync as EventListener)},[])
 useEffect(()=>{const handler=(e:Event)=>{const detail=(e as CustomEvent<{resolve:(value:boolean)=>void}>).detail;void save().then(ok=>detail?.resolve(ok),()=>{setSaving(false);setMessage('Salvataggio del menu non riuscito. Riprova.');detail?.resolve(false)})};window.addEventListener('orders-ng-save-menu',handler);return()=>window.removeEventListener('orders-ng-save-menu',handler)},[adultLines,babyLines,recipes,adultMenuId,babyMenuId,adultTotal,babyTotal,eventNumber,baby,loading,saving,loadError])
 useEffect(()=>{let exporting=false;const handler=async(e:Event)=>{const request=(e as CustomEvent<EventPdfRequest>).detail;const fail=(message:string)=>{setMessage(message);if(request.preview&&!request.preview.closed){request.preview.document.title='PDF non generato';request.preview.document.body.textContent=message}};if(exporting){request.preview?.close();return;}if(loading||saving||loadError){fail('Attendi il caricamento del menu prima di generare il PDF.');return}if([...adultLines,...babyLines].some(l=>!l.recipe_id&&!l.display_name?.trim())){fail('Seleziona una ricetta per ogni portata prima di generare il PDF.');return}exporting=true;setMessage('Generazione PDF in corso…');try{const {downloadEventPdf}=await import('@/lib/event-pdf');const result=await downloadEventPdf(request,adultLines,babyLines,recipes);if(result){if(pdfUrl.current)URL.revokeObjectURL(pdfUrl.current);pdfUrl.current=result.url;returnFocus.current=document.activeElement as HTMLElement;setPdfPreview(result)}setMessage('PDF generato.')}catch(error){fail(error instanceof Error?error.message:'Generazione PDF non riuscita. Riprova.')}finally{exporting=false}};window.addEventListener('orders-ng-export-event-pdf',handler);return()=>window.removeEventListener('orders-ng-export-event-pdf',handler)},[adultLines,babyLines,recipes,loading,saving,loadError])
 function block(a:Audience,title:string,count:number){const lines=linesFor(a);return <section className="compositionBox eventMenuBlock"><div className="compositionHead"><div><span className="eyebrow">{title}</span><h3>Portate <small className="menuGuestCount">· {count} ospiti</small></h3></div><button type="button" className="secondary" onClick={()=>addLine(a)}><Plus size={16}/> Aggiungi portata</button></div>{lines.length===0?<div className="empty">Nessuna portata. Aggiungi la prima ricetta al menu.</div>:<div className="eventMenuLines"><div className="eventMenuLine eventMenuHeader"><span>Ricetta</span><span>Categoria</span><span>Porzioni</span><span>Prezzo</span><span></span></div>{lines.map((line,idx)=>{const recipe=recipes.find(r=>r.id===line.recipe_id);const price=recipe?.sale_price??line.sale_price??0;return <div key={idx} className="eventMenuLine"><select value={line.recipe_id} onChange={e=>{const selected=recipes.find(r=>r.id===e.target.value);updateLine(a,idx,{recipe_id:e.target.value,display_name:undefined,course_type:selected?.category||'other',sale_price:selected?.sale_price||0})}}><option value="">{!line.recipe_id&&line.display_name?line.display_name:"Seleziona ricetta"}</option>{recipes.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select><strong>{recipe?.category||line.course_type||'—'}</strong><input className="menuPortionsInput" type="number" min="0" step="1" value={line.portions??count} onChange={e=>updateLine(a,idx,{portions:Number(e.target.value)})}/><strong className="menuPrice">{line.recipe_id||line.display_name?euro(price):'—'}</strong><div className="menuLineActions"><button type="button" className="ghost" onClick={()=>moveLine(a,idx,-1)} disabled={idx===0}>↑</button><button type="button" className="ghost" onClick={()=>moveLine(a,idx,1)} disabled={idx===lines.length-1}>↓</button><button type="button" className="deleteLine" onClick={()=>removeLine(a,idx)}><Trash2 size={16}/></button></div></div>})}</div>}<small className="fieldHint">Le porzioni partono da {count} ma possono essere modificate per ogni singola portata.</small></section>}
 return <div className="eventMenusWrap">{pdfPreview&&createPortal(<section className="eventPdfPreview eventPdfFullscreen" role="dialog" aria-modal="true" aria-label="Anteprima PDF"><div className="eventPdfPreviewActions"><strong>PDF pronto</strong><a className="secondary" href={pdfPreview.url} download={pdfPreview.filename}>Scarica PDF</a><a className="secondary" href={pdfPreview.url} target="_blank" rel="noopener">Apri PDF</a><button ref={previewClose} type="button" className="secondary" onClick={closePdf}>Torna all’evento</button></div><iframe title={pdfPreview.filename} src={pdfPreview.url}/></section>,document.body)}{loading?<div className="empty">Caricamento menu…</div>:<>{block('adult','MENU ADULTI',adults)}{baby>0&&block('baby','MENU BABY',baby)}</>}{message&&<div className={['Menu salvato.','PDF generato.','Generazione PDF in corso…'].includes(message)?'fieldHint':'errorBox'}>{message}</div>}</div>
}
