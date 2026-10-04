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
export type EventPdfRequest = { kind: 'quote' | 'kitchen'; event: EventPdfData }
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
  const {kind, event: e} = request
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
  doc.save(`${request.kind==='quote'?'preventivo':'cucina'}_evento_${request.event.event_number}_${request.event.event_date}.pdf`)
}
