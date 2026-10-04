import { jsPDF } from 'jspdf'
import { DEDICATED_MENU_FIELDS, dedicatedMenuCount, DedicatedMenuCounts } from './dedicated-menus'
import type { EventMenuLine, MenuRecipeOption } from './supabase'
import { normalizeRecipeCategory } from '../components/RecipeCategories'

export type EventPdfData = DedicatedMenuCounts & {
  event_number: number; event_date: string; service: string; adults: number; baby: number;
  price_per_adult: number; price_per_baby: number; internal_notes: string;
  client?: { company_name?: string | null; first_name?: string | null; last_name?: string | null; phone?: string | null; email?: string | null } | null
}
export type EventPdfRequest = { kind: 'quote' | 'kitchen'; event: EventPdfData; preview?: Window | null }
const conditions = [
  'Il menu è comprensivo di coperto, acqua, pane e caffè. Vini e amari come dettagliato nel punto seguente.',
  'Vino in ragione di 1 bottiglia ogni 3 persone, il resto sarà contabilizzato come da carta dei vini. Amari in ragione di 1 a persona.',
  'La disposizione dei tavoli se non concordata e dettagliata a mezzo mail resta a discrezione della direzione.',
  'I prezzi non subiranno variazioni per l’anno corrente. Per i prezzi dei prodotti non elencati si rimanda al listino generale.',
  'Eventuali forme di intrattenimento dovranno essere concordate preventivamente con la direzione, la quale si riserva il diritto di discrezionalità sulla possibilità di esecuzione. Resta invariato l’orario di chiusura del locale a prescindere dalla timeline dello spettacolo.',
  'L’accettazione della presente sarà perfezionata solo dopo l’approvazione dalle parti e il versamento a mezzo bonifico dell’acconto.'
]
const money = (n: number) => new Intl.NumberFormat('it-IT', {minimumFractionDigits: 2, maximumFractionDigits: 2}).format(n)
const footer = 'ristorante Officina22 made by Vita nei Campi - via M. Marmolada, 5 - 65010 Cavaticchi di Spoltore - Tel. 3452113070'

export async function createEventPdf(request: EventPdfRequest, adult: EventMenuLine[], baby: EventMenuLine[], recipes: MenuRecipeOption[], logo?: string) {
  if(request.kind==='kitchen') return createKitchenPdf(request.event,adult,baby,recipes)
  if(!logo) throw new Error('Logo del preventivo non disponibile. Riprova.')
  const e=request.event, doc=new jsPDF({format:'a4'})
  const client=e.client
  const name=client?.company_name || [client?.first_name,client?.last_name].filter(Boolean).join(' ') || 'Cliente non assegnato'
  const gold=[161,135,80] as const
  const text=(value:string|string[],x:number,y:number,size:number,font='helvetica',color:readonly number[]=[36,36,36])=>{
    doc.setCharSpace(0);doc.setFont(font,'normal');doc.setFontSize(size);doc.setTextColor(color[0],color[1],color[2]);doc.text(value,x,y,{lineHeightFactor:1.134})
  }
  const wrap=(value:string,width:number,size:number,font='times')=>{
    doc.setFont(font,'normal');doc.setFontSize(size);return doc.splitTextToSize(value,width) as string[]
  }
  const rule=(y:number)=>{doc.setDrawColor(...gold);doc.setLineWidth(.2);doc.line(16,y,194,y)}
  const groups=(items:EventMenuLine[])=>{
    const map=new Map<string,string[]>()
    for(const l of items){const r=recipes.find(r=>r.id===l.recipe_id);const category=normalizeRecipeCategory(r?.category||l.course_type)||r?.category||l.course_type||'Portate';if(!map.has(category))map.set(category,[]);map.get(category)!.push(r?.name||'Portata')}
    return [...map.entries()]
  }
  const adults=groups(adult),babies=groups(baby)
  const hasBaby=e.baby>0||baby.length>0
  const dedicated=DEDICATED_MENU_FIELDS.filter(f=>dedicatedMenuCount(e,f.key)>0)
  // Reserve the entire conditions block before measuring the menu.
  const clauses=conditions.map(c=>wrap(c,171,7.2,'helvetica'))
  const clauseHeight=clauses.reduce((h,rows)=>h+rows.length*3.05+1.5,0)
  const conditionsTop=277-clauseHeight-7
  const image=doc.getImageProperties(logo)
  const logoHeight=Math.min(27,65*image.height/image.width)
  const logoWidth=logoHeight*image.width/image.height
  doc.addImage(logo,'PNG',16,13,logoWidth,logoHeight)
  const headerX=94, headerWidth=100
  const nameLines=wrap(name,headerWidth,16)
  const contacts=[client?.phone,client?.email].filter(Boolean).join('  /  ')
  const contactLines=contacts?wrap(contacts,headerWidth,8,'helvetica'):[]
  const headerY=17
  text('PREVENTIVO BANCHETTO',headerX,headerY,8,'helvetica',gold)
  text(nameLines,headerX,headerY+10,16,'times')
  let infoY=headerY+10+nameLines.length*6.4
  text(`riferimento #${e.event_number}`,headerX,infoY,8,'helvetica',gold)
  infoY+=6
  const service=e.service.charAt(0).toUpperCase()+e.service.slice(1).toLowerCase()
  const details=wrap(`${e.event_date.split('-').reverse().join('/')}  /  ${service}  /  ${e.adults} adulti${hasBaby?' + '+e.baby+' baby':''}`,headerWidth,9,'helvetica')
  text(details,headerX,infoY,9);infoY+=details.length*3.6+2
  if(contactLines.length){text(contactLines,headerX,infoY,8);infoY+=contactLines.length*3.2+2}
  infoY=Math.max(infoY,13+logoHeight)+3
  rule(infoY+2)
  const bodyTop=infoY+11, leftWidth=hasBaby||dedicated.length?108:178, rightX=136, rightWidth=58
  const gap=(size:number)=>Math.max(.7,(size-8)*.7+.7)
  const groupHeight=(list:ReturnType<typeof groups>,width:number,size:number)=>list.reduce((h,[category,items])=>h+wrap(category.toUpperCase(),width,8,'helvetica').length*3.2+2+items.reduce((n,item)=>n+wrap(item,width,size).length*size*.4+gap(size),0)+gap(size)+3,0)
  let size=11
  let leftHeight=0,rightHeight=0
  for(;size>=8;size-=.5){
    leftHeight=groupHeight(adults,leftWidth,size)+7
    rightHeight=(hasBaby?groupHeight(babies,rightWidth,size)+7:0)+(dedicated.length?12+dedicated.reduce((h,f)=>h+wrap(`${f.label}: ${dedicatedMenuCount(e,f.key)}`,rightWidth,size,'helvetica').length*size*.4+2,0):0)
    if(bodyTop+Math.max(leftHeight,rightHeight)+26<=conditionsTop-9)break
  }
  if(size<8)throw new Error('Il preventivo supera lo spazio di una pagina. Riduci la lunghezza del menu o dei dati cliente e riprova. Nessun contenuto è stato tagliato.')
  const drawGroups=(list:ReturnType<typeof groups>,x:number,y:number,width:number)=>{
    for(const [category,items] of list){
      const cat=wrap(category.toUpperCase(),width,8,'helvetica')
      text(cat,x,y,8,'helvetica',gold);y+=cat.length*3.2+2
      for(const item of items){const rows=wrap(item,width,size);text(rows,x,y,size,'times');y+=rows.length*size*.4+gap(size)}
      y+=gap(size)+3
    }
    return y
  }
  text('MENU ADULTI',16,bodyTop,9,'helvetica',gold)
  const leftEnd=drawGroups(adults,16,bodyTop+7,leftWidth)
  let rightEnd=bodyTop
  if(hasBaby){text('MENU BABY',rightX,rightEnd,9,'helvetica',gold);rightEnd=drawGroups(babies,rightX,rightEnd+7,rightWidth)}
  if(dedicated.length){
    rightEnd+=5;text('MENU DEDICATI',rightX,rightEnd,9,'helvetica',gold);rightEnd+=7
    for(const f of dedicated){const rows=wrap(`${f.label}: ${dedicatedMenuCount(e,f.key)}`,rightWidth,size,'helvetica');text(rows,rightX,rightEnd,size);rightEnd+=rows.length*size*.4+2}
  }
  const priceY=Math.max(leftEnd,rightEnd)+5
  rule(priceY);text('PREZZO PER PERSONA',16,priceY+7,8,'helvetica',gold)
  text(`Adulti  € ${money(e.price_per_adult)}`,16,priceY+16,15,'times')
  if(hasBaby)text(`Baby  € ${money(e.price_per_baby)}`,rightX,priceY+16,15,'times')
  // Fixed bottom placement, independent of the menu length.
  rule(conditionsTop-3)
  text('CONDIZIONI DEL PREVENTIVO',16,conditionsTop+1,8,'helvetica',gold)
  let cy=conditionsTop+7
  clauses.forEach((rows,i)=>{text(`${i+1}.`,16,cy,7.2);text(rows,21,cy,7.2);cy+=rows.length*3.05+1.5})
  doc.setDrawColor(218,214,206);doc.line(16,284,194,284)
  text(footer,16,289,6)
  return doc
}

export async function downloadEventPdf(request: EventPdfRequest, adult: EventMenuLine[], baby: EventMenuLine[], recipes: MenuRecipeOption[]) {
  let logo: string | undefined
  if(request.kind==='quote') {
    const response=await fetch('/quote-logo-classic-v2.png')
    if(!response.ok)throw new Error('Impossibile caricare il logo del preventivo.')
    const blob=await response.blob()
    logo=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('Impossibile leggere il logo.'));reader.readAsDataURL(blob)})
  }
  const doc=await createEventPdf(request,adult,baby,recipes,logo)
  const filename=`${request.kind==='quote'?'preventivo':'cucina'}_evento_${request.event.event_number}_${request.event.event_date}.pdf`
  const url=URL.createObjectURL(doc.output('blob'))
  if(request.preview && !request.preview.closed){try{request.preview.location.replace(url)}catch{/* The inline preview remains available when a standalone app blocks navigation. */}}
  return {url,filename}
}


function createKitchenPdf(e: EventPdfData, adult: EventMenuLine[], baby: EventMenuLine[], recipes: MenuRecipeOption[]) {
  const doc=new jsPDF({format:'a4'})
  const client=e.client
  const name=client?.company_name || [client?.first_name,client?.last_name].filter(Boolean).join(' ') || 'Cliente non assegnato'
  const recipeMap=new Map(recipes.map(r=>[r.id,r]))
  const groups=(items:EventMenuLine[],count:number)=>{
    const map=new Map<string,{name:string;portions:number}[]>()
    for(const line of items){const r=recipeMap.get(line.recipe_id);const category=normalizeRecipeCategory(r?.category||line.course_type)||r?.category||line.course_type||'Portate';if(!map.has(category))map.set(category,[]);map.get(category)!.push({name:r?.name||'Portata',portions:line.portions??count})}
    return [...map.entries()]
  }
  const adults=groups(adult,e.adults), babies=groups(baby,e.baby)
  const dedicated=DEDICATED_MENU_FIELDS.filter(f=>dedicatedMenuCount(e,f.key)>0)
  const wrapped=(text:string,width:number,size:number,bold=false)=>{doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);return doc.splitTextToSize(text,width) as string[]}
  const gapFor=(size:number)=>Math.max(.6,(size-8)*.8+.6)
  const height=(list:ReturnType<typeof groups>,width:number,size:number)=>list.reduce((h,[category,items])=>h+wrapped(category.toUpperCase(),width-8,size,true).length*size*.4+gapFor(size)+items.reduce((sum,item)=>sum+wrapped(item.name,width-23,size).length*size*.4+gapFor(size),0)+gapFor(size)+size*.3,0)
  let size=11
  let noteLines:string[]=[],nameLines:string[]=[],leftHeight=0,rightHeight=0,notesHeight=0,bodyTop=0
  for(;size>=8;size-=.5){
    nameLines=wrapped(`${name} - #${e.event_number}`,112,size,true)
    bodyTop=21+Math.max(20,nameLines.length*size*.4+12)+7
    noteLines=e.internal_notes.trim()?wrapped(e.internal_notes,180,size):[]
    notesHeight=13+noteLines.length*size*.4+30
    leftHeight=height(adults,118,size)+14
    rightHeight=(babies.length?height(babies,66,size)+17:0)+(dedicated.length?14+dedicated.length*(size*.4+4):0)
    if(bodyTop+Math.max(leftHeight,rightHeight)+8+notesHeight<=280)break
  }
  if(size<8)throw new Error('La scheda cucina supera lo spazio di una pagina. Riduci la lunghezza delle note o dei nomi delle portate e riprova. Nessun contenuto è stato tagliato.')
  const text=(value:string|string[],x:number,y:number,fontSize=size,bold=false,align:'left'|'right'|'center'='left')=>{doc.setCharSpace(0);doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(fontSize);doc.text(value,x,y,{align,lineHeightFactor:1.134})}
  const box=(x:number,y:number,width:number,h:number,fill=246)=>{doc.setDrawColor(195);doc.setFillColor(fill,fill,fill);doc.rect(x,y,width,h,'FD')}
  text('OFFICINA22',10,15,13);text('SCHEDA EVENTO',200,15,13,false,'right')
  const headerHeight=Math.max(20,nameLines.length*size*.4+12)
  doc.setFillColor(249,216,70);doc.rect(10,21,118,headerHeight,'F')
  text(nameLines,14,27,size,true)
  const eventDate=new Date(e.event_date+'T12:00:00')
  const longDate=new Intl.DateTimeFormat('it-IT',{weekday:'long',day:'numeric',month:'long'}).format(eventDate)
  const service=e.service.charAt(0).toUpperCase()+e.service.slice(1).toLowerCase()
  text(`${longDate} - ${service}`,14,31+nameLines.length*size*.4,9,true)
  ;[['ADULTI',e.adults],['BABY',e.baby]].forEach(([label,value],i)=>{const x=134+i*35;box(x,21,31,headerHeight);text(String(label),x+15.5,27,8,true,'center');text(String(value),x+15.5,37,18,true,'center')})
  const section=(title:string,x:number,y:number,width:number)=>{box(x,y,width,9);text(title,x+3,y+6,10,true)}
  const drawGroups=(list:ReturnType<typeof groups>,x:number,y:number,width:number)=>{
    for(const [category,items] of list){const cat=wrapped(category.toUpperCase(),width-8,size,true);text(cat,x+3,y,size,true);y+=cat.length*size*.4+gapFor(size)
      for(const item of items){const name=wrapped(item.name,width-23,size);text(name,x+3,y);text(String(item.portions),x+width-4,y,size+1,false,'right');y+=name.length*size*.4+gapFor(size)}
      doc.setDrawColor(215);doc.line(x+3,y-.3,x+width-3,y-.3);y+=gapFor(size)+size*.3
    }return y
  }
  section('MENU ADULTI',10,bodyTop,118);text('PORZIONI',124,bodyTop+6,8,true,'right')
  const adultEnd=drawGroups(adults,10,bodyTop+15,118)
  let rightY=bodyTop
  if(babies.length){section(`MENU BABY - ${e.baby}`,134,rightY,66);rightY=drawGroups(babies,134,rightY+15,66)+3}
  if(dedicated.length){doc.setFillColor(255,247,209);doc.setDrawColor(215);doc.rect(134,rightY,66,14+dedicated.length*(size*.4+4),'FD');text('MENU DEDICATI',137,rightY+7,10,true);rightY+=15;for(const f of dedicated){text(f.label,137,rightY);text(String(dedicatedMenuCount(e,f.key)),196,rightY,size+1,true,'right');rightY+=size*.4+4}}
  const noteTop=Math.max(adultEnd,rightY)+7
  section('NOTE OPERATIVE',10,noteTop,190)
  doc.setDrawColor(195);doc.rect(10,noteTop+9,190,notesHeight-9)
  if(noteLines.length)text(noteLines,15,noteTop+15)
  const ruledTop=noteTop+15+noteLines.length*size*.4
  doc.setDrawColor(190);for(let i=1;i<=4;i++)doc.line(15,ruledTop+i*6,195,ruledTop+i*6)
  text('Orders NextGen - Scheda evento',10,290,7);text('1 / 1',200,290,7,false,'right')
  return doc
}
