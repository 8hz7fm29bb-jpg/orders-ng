import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
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
  const e=request.event; const kind: 'quote' | 'kitchen' = request.kind as 'quote' | 'kitchen'
  const doc = new jsPDF({format: 'a4'})
  const client = e.client
  const name = client?.company_name || [client?.first_name, client?.last_name].filter(Boolean).join(' ') || 'Cliente non assegnato'
  const date = e.event_date.split('-').reverse().join('/')
  const dedicated = DEDICATED_MENU_FIELDS.filter(f => dedicatedMenuCount(e, f.key) > 0).map(f => `${f.label}: ${dedicatedMenuCount(e, f.key)}`)
  const lines = (items: EventMenuLine[], count: number) => items.map(l => {
    const r = recipes.find(r => r.id === l.recipe_id)
    return [normalizeRecipeCategory(r?.category || l.course_type) || r?.category || l.course_type || 'Portata', r?.name || 'Portata', String(l.portions ?? count)]
  })
  let y = 20
  if(kind === 'quote') {
    if (!logo) throw new Error('Logo del preventivo non disponibile. Riprova.')
    const image = doc.getImageProperties(logo)
    const height = Math.min(30, 74 * image.height / image.width)
    const width = height * image.width / image.height
    doc.addImage(logo, 'PNG', (210-width)/2, 15, width, height)
    y = 55
    doc.setFont('helvetica', 'italic'); doc.setFontSize(9)
    doc.text(`preventivo n ${e.event_number} - ${e.service} del ${date}`, 105, y, {align:'center'})
    const reserved = doc.splitTextToSize(`riservato a ${name}${client?.phone ? ', telefono '+client.phone : ''}${client?.email ? ', mail '+client.email : ''}`, 165)
    doc.text(reserved, 105, y+6, {align:'center'})
    y += 6 + reserved.length*4 + 7
  } else {
    doc.setFont('helvetica','bold'); doc.setFontSize(17); doc.text('BRIEF OPERATIVO',105,y,{align:'center'})
    doc.setFontSize(10)
    const header = doc.splitTextToSize(`#${e.event_number} - ${date} - ${e.service.toUpperCase()} - ${name}`, 185)
    doc.text(header,105,y+8,{align:'center'}); y += 12+header.length*4
  }
  doc.setCharSpace(0); doc.setFont('helvetica','normal'); doc.setFontSize(10)
  doc.text(`Adulti: ${e.adults}   |   Baby: ${e.baby}`, kind==='quote'?25:10, y)
  y += 7
  const table = (title: string, rows: string[][]) => {
    if(!rows.length) return
    const margin = kind==='quote'?25:10
    if(y>250){doc.addPage();y=20}
    doc.setFont('helvetica','bold');doc.setFontSize(10);doc.text(title,margin,y)
    autoTable(doc,{startY:y+3,margin:{left:margin,right:margin,bottom:20},theme:kind==='quote'?'plain':'grid',
      head:kind==='kitchen'?[['Categoria','Portata','Porzioni']]:undefined,
      body:rows.map(row=>kind==='quote'?row.slice(0,2):row),
      styles:{font:'helvetica',fontSize:kind==='quote'?10:9,cellPadding:kind==='quote'?2.5:3,textColor:0,overflow:'linebreak'},
      headStyles:{fillColor:240,textColor:0},columnStyles:kind==='quote'?{0:{cellWidth:38,fontStyle:'italic'},1:{cellWidth:122}}:{0:{cellWidth:35},1:{cellWidth:130},2:{cellWidth:25,halign:'right'}}})
    y = (doc as jsPDF & {lastAutoTable:{finalY:number}}).lastAutoTable.finalY+10
  }
  table('MENU ADULTI',lines(adult,e.adults))
  if(e.baby>0 || baby.length) table('MENU BABY',lines(baby,e.baby))
  if(dedicated.length) table('MENU DEDICATI',[['Esigenze alimentari',dedicated.join('   |   '),'']])
  if(kind==='kitchen') {
    if(e.internal_notes.trim()) table('NOTE INTERNE',[[ '',e.internal_notes,'']])
    if(y>235){doc.addPage();y=20}
    doc.setFont('helvetica','bold');doc.setFontSize(10);doc.text('ANNOTAZIONI',10,y)
    doc.setDrawColor(180);doc.roundedRect(10,y+4,190,42,3,3)
    for(let i=1;i<5;i++)doc.line(14,y+4+i*8,196,y+4+i*8)
  } else {
    const prices = [`Il prezzo per persona a Voi riservato è di ${money(e.price_per_adult)} euro.`]
    if(e.baby>0) prices.push(`Il menu baby pensato per i più piccoli a ${money(e.price_per_baby)} euro.`)
    const priceText=doc.splitTextToSize(prices.join(' '),160)
    doc.setFont('helvetica','normal');doc.setFontSize(10)
    if(y+priceText.length*5>240){doc.addPage();y=20}
    doc.text(priceText,105,y,{align:'center'});y+=priceText.length*5+10
    doc.setFontSize(7.2)
    const clauses = conditions.map(c=>doc.splitTextToSize('• '+c,184) as string[])
    const h=clauses.reduce((sum,c)=>sum+c.length*3.2+2,0)
    const top=277-h
    if(y>top-5)doc.addPage()
    let cy=top
    clauses.forEach(c=>{doc.text(c,13,cy);cy+=c.length*3.2+2})
  }
  for(let page=1;page<=doc.getNumberOfPages();page++){
    doc.setPage(page);doc.setFont('helvetica','normal');doc.setFontSize(6.5)
    doc.text(footer,105,289,{align:'center'});doc.text(`${page} / ${doc.getNumberOfPages()}`,200,294,{align:'right'})
  }
  return doc
}

export async function downloadEventPdf(request: EventPdfRequest, adult: EventMenuLine[], baby: EventMenuLine[], recipes: MenuRecipeOption[]) {
  let logo: string | undefined
  if(request.kind==='quote') {
    const response=await fetch('/quote-logo.png')
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
  text('OFFICINA22',10,15,13,true);text('SCHEDA CUCINA',200,15,17,true,'right')
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
      for(const item of items){const name=wrapped(item.name,width-23,size);text(name,x+3,y);text(String(item.portions),x+width-4,y,size+1,true,'right');y+=name.length*size*.4+gapFor(size)}
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
