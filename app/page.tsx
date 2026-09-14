'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChefHat, ClipboardList, ContactRound, Euro, FileText, LayoutDashboard, LogOut, Menu, PackageSearch, Plus, Search, UsersRound, X } from 'lucide-react'
import { supabase, configured } from '@/lib/supabase'
import { Modal } from '@/components/Modal'

type Section = 'dashboard' | 'events' | 'clients' | 'recipes' | 'ingredients' | 'reports'
type Client = { id: string; customer_type: string; first_name: string | null; last_name: string | null; company_name: string | null; phone: string | null; email: string | null; city: string | null; notes: string | null }
type EventRow = { id: string; event_number: number; client_id: string | null; title: string | null; event_date: string; service: string | null; event_type: string | null; adults: number; children: number; baby: number; status: string; location: string | null; room: string | null; price_per_adult: number | null; deposit_amount: number; internal_notes: string | null; client?: Client | null }
type Ingredient = { id: string; name: string; category: string | null; current_price: number; active: boolean }
type Recipe = { id: string; name: string; category: string | null; standard_portions: number; target_food_cost_percent: number | null; manual_sale_price: number | null; active: boolean }

const sections: { id: Section; label: string; icon: any }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'events', label: 'Eventi', icon: CalendarDays },
  { id: 'clients', label: 'Clienti', icon: UsersRound },
  { id: 'recipes', label: 'Ricettario', icon: ChefHat },
  { id: 'ingredients', label: 'Ingredienti', icon: PackageSearch },
  { id: 'reports', label: 'Report', icon: ClipboardList },
]

const statusLabel: Record<string, string> = {
  bozza: 'Bozza', preventivo_inviato: 'Preventivo inviato', in_attesa: 'In attesa', confermato: 'Confermato', in_produzione: 'In produzione', eseguito: 'Eseguito', chiuso: 'Chiuso', annullato: 'Annullato'
}

function nameOfClient(c?: Client | null) {
  if (!c) return 'Cliente non assegnato'
  return c.company_name || [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Cliente'
}

function euro(v: number | null | undefined) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(v || 0))
}

export default function Home() {
  const [sessionReady, setSessionReady] = useState(false)
  const [signedIn, setSignedIn] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authMessage, setAuthMessage] = useState('')
  const [section, setSection] = useState<Section>('dashboard')
  const [sidebar, setSidebar] = useState(false)
  const [clients, setClients] = useState<Client[]>([])
  const [events, setEvents] = useState<EventRow[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [modal, setModal] = useState<'event' | 'client' | 'ingredient' | 'recipe' | null>(null)
  const [editingEvent, setEditingEvent] = useState<EventRow | null>(null)

  useEffect(() => {
    if (!supabase) { setSessionReady(true); return }
    supabase.auth.getSession().then(({ data }) => { setSignedIn(Boolean(data.session)); setSessionReady(true) })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setSignedIn(Boolean(session)))
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (signedIn) refreshAll()
  }, [signedIn])

  async function refreshAll() {
    if (!supabase) return
    setLoading(true)
    const [c, e, i, r] = await Promise.all([
      supabase.from('clients').select('*').order('created_at', { ascending: false }),
      supabase.from('events').select('*, client:clients(*)').order('event_date', { ascending: true }),
      supabase.from('ingredients').select('id,name,category,current_price,active').order('name'),
      supabase.from('recipes').select('id,name,category,standard_portions,target_food_cost_percent,manual_sale_price,active').order('name'),
    ])
    if (c.data) setClients(c.data as Client[])
    if (e.data) setEvents(e.data as any)
    if (i.data) setIngredients(i.data as Ingredient[])
    if (r.data) setRecipes(r.data as Recipe[])
    setLoading(false)
  }

  async function signIn(e: FormEvent) {
    e.preventDefault(); if (!supabase) return
    setAuthMessage('Accesso in corso…')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setAuthMessage(error ? error.message : '')
  }

  async function logout() { await supabase?.auth.signOut() }

  const today = new Date().toISOString().slice(0, 10)
  const upcoming = events.filter(e => e.event_date >= today && e.status !== 'annullato').slice(0, 6)
  const confirmed = events.filter(e => e.event_date >= today && e.status === 'confermato').length
  const waiting = events.filter(e => ['preventivo_inviato','in_attesa'].includes(e.status)).length
  const monthPrefix = today.slice(0,7)
  const monthEvents = events.filter(e => e.event_date.startsWith(monthPrefix) && e.status !== 'annullato').length

  if (!configured) return <SetupScreen />
  if (!sessionReady) return <div className="centerScreen"><div className="spinner" /></div>
  if (!signedIn) return <Login email={email} password={password} setEmail={setEmail} setPassword={setPassword} submit={signIn} message={authMessage} />

  return (
    <div className="appShell">
      <aside className={sidebar ? 'sidebar open' : 'sidebar'}>
        <div className="brand"><div className="brandMark">22</div><div><strong>Orders NG</strong><span>Officina22</span></div><button className="mobileClose" onClick={() => setSidebar(false)}><X /></button></div>
        <nav>{sections.map(s => { const Icon = s.icon; return <button key={s.id} className={section===s.id?'navItem active':'navItem'} onClick={() => {setSection(s.id);setSidebar(false)}}><Icon size={19}/><span>{s.label}</span></button> })}</nav>
        <div className="sidebarBottom"><button className="navItem" onClick={logout}><LogOut size={19}/><span>Esci</span></button></div>
      </aside>
      {sidebar && <div className="scrim" onClick={() => setSidebar(false)} />}
      <main className="main">
        <header className="topbar"><button className="menuButton" onClick={() => setSidebar(true)}><Menu /></button><div><span className="eyebrow">ORDERS NG</span><h1>{sections.find(s=>s.id===section)?.label}</h1></div><button className="primary" onClick={() => {setEditingEvent(null);setModal('event')}}><Plus size={18}/> Nuovo evento</button></header>
        <div className="content">
          {loading && <div className="loadingLine" />}
          {section==='dashboard' && <Dashboard upcoming={upcoming} confirmed={confirmed} waiting={waiting} monthEvents={monthEvents} onOpen={(e: EventRow)=>{setEditingEvent(e);setModal('event')}} onSection={setSection}/>} 
          {section==='events' && <Events events={events} query={query} setQuery={setQuery} onOpen={(e: EventRow)=>{setEditingEvent(e);setModal('event')}}/>}
          {section==='clients' && <Clients clients={clients} query={query} setQuery={setQuery} onNew={()=>setModal('client')}/>} 
          {section==='recipes' && <Recipes recipes={recipes} onNew={()=>setModal('recipe')}/>} 
          {section==='ingredients' && <Ingredients ingredients={ingredients} onNew={()=>setModal('ingredient')}/>} 
          {section==='reports' && <Reports events={events}/>} 
        </div>
      </main>
      {modal==='event' && <EventModal clients={clients} event={editingEvent} onClose={()=>{setModal(null);setEditingEvent(null)}} onSaved={refreshAll}/>} 
      {modal==='client' && <ClientModal onClose={()=>setModal(null)} onSaved={refreshAll}/>} 
      {modal==='ingredient' && <IngredientModal onClose={()=>setModal(null)} onSaved={refreshAll}/>} 
      {modal==='recipe' && <RecipeModal onClose={()=>setModal(null)} onSaved={refreshAll}/>} 
    </div>
  )
}

function SetupScreen(){return <div className="setup"><div className="setupCard"><div className="brandMark big">22</div><h1>Orders NG</h1><p>Il frontend è pronto. Mancano soltanto le due variabili Supabase.</p><code>NEXT_PUBLIC_SUPABASE_URL</code><code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code><p className="muted">Inseriscile su Vercel nelle Environment Variables oppure nel file .env.local per l'uso sul Mac.</p></div></div>}

function Login({email,password,setEmail,setPassword,submit,message}:any){return <div className="loginWrap"><form className="loginCard" onSubmit={submit}><div className="brandMark big">22</div><div><span className="eyebrow">OFFICINA22</span><h1>Orders NG</h1><p>Accedi al gestionale.</p></div><label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email"/></label><label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password"/></label>{message&&<div className="errorBox">{message}</div>}<button className="primary full" type="submit">Accedi</button></form></div>}

function Dashboard({upcoming,confirmed,waiting,monthEvents,onOpen,onSection}:any){return <><div className="hero"><div><span className="eyebrow">PANORAMICA OPERATIVA</span><h2>Il lavoro che richiede attenzione, subito.</h2><p>Eventi, preventivi e produzione in un'unica vista.</p></div><div className="heroBadge"><CalendarDays/><span>Oggi</span><strong>{new Intl.DateTimeFormat('it-IT',{day:'2-digit',month:'long'}).format(new Date())}</strong></div></div><div className="stats"><Stat label="Eventi questo mese" value={monthEvents}/><Stat label="Confermati futuri" value={confirmed}/><Stat label="Preventivi da seguire" value={waiting}/><Stat label="Prossimi eventi" value={upcoming.length}/></div><div className="grid2"><section className="panel"><div className="panelHead"><div><span className="eyebrow">AGENDA</span><h3>Prossimi eventi</h3></div><button className="textButton" onClick={()=>onSection('events')}>Vedi tutti</button></div>{upcoming.length===0?<Empty text="Nessun evento futuro."/>:<div className="eventList">{upcoming.map((e:EventRow)=><button className="eventRow" key={e.id} onClick={()=>onOpen(e)}><div className="dateTile"><strong>{new Date(e.event_date+'T12:00:00').getDate()}</strong><span>{new Intl.DateTimeFormat('it-IT',{month:'short'}).format(new Date(e.event_date+'T12:00:00'))}</span></div><div className="eventInfo"><strong>{e.title||nameOfClient(e.client)}</strong><span>{nameOfClient(e.client)} · {e.service||'servizio da definire'}</span></div><span className={'status s-'+e.status}>{statusLabel[e.status]||e.status}</span></button>)}</div>}</section><section className="panel"><div className="panelHead"><div><span className="eyebrow">FLUSSO</span><h3>Orders NG</h3></div></div><div className="flow"><Flow n="01" title="Evento" text="Cliente, data, ospiti e servizio"/><Flow n="02" title="Menu" text="Portate collegate alle ricette"/><Flow n="03" title="Food cost" text="Costo reale e prezzo suggerito"/><Flow n="04" title="Preventivo" text="PDF cliente versionato"/><Flow n="05" title="Produzione" text="Quantità aggregate per la cucina"/></div></section></div></>}
function Stat({label,value}:{label:string,value:number}){return <div className="stat"><span>{label}</span><strong>{value}</strong></div>}
function Flow({n,title,text}:{n:string,title:string,text:string}){return <div className="flowRow"><span>{n}</span><div><strong>{title}</strong><p>{text}</p></div></div>}
function Empty({text}:{text:string}){return <div className="empty">{text}</div>}

function SearchBar({value,setValue,placeholder,action}:any){return <div className="toolbar"><div className="search"><Search size={18}/><input value={value} onChange={e=>setValue(e.target.value)} placeholder={placeholder}/></div>{action}</div>}
function Events({events,query,setQuery,onOpen}:any){const q=query.toLowerCase();const list=events.filter((e:EventRow)=>[e.title,nameOfClient(e.client),e.event_type,e.status].join(' ').toLowerCase().includes(q));return <><SearchBar value={query} setValue={setQuery} placeholder="Cerca evento, cliente, stato…"/><section className="panel tablePanel"><div className="responsiveTable"><table><thead><tr><th>N.</th><th>Data</th><th>Cliente / Evento</th><th>Servizio</th><th>Ospiti</th><th>Stato</th><th>Prezzo</th></tr></thead><tbody>{list.map((e:EventRow)=><tr key={e.id} onClick={()=>onOpen(e)}><td>#{e.event_number}</td><td>{new Intl.DateTimeFormat('it-IT').format(new Date(e.event_date+'T12:00:00'))}</td><td><strong>{e.title||nameOfClient(e.client)}</strong><small>{nameOfClient(e.client)}</small></td><td>{e.service||'—'}</td><td>{e.adults+e.children+e.baby}</td><td><span className={'status s-'+e.status}>{statusLabel[e.status]||e.status}</span></td><td>{e.price_per_adult?euro(e.price_per_adult):'—'}</td></tr>)}</tbody></table></div>{list.length===0&&<Empty text="Nessun evento trovato."/>}</section></>}
function Clients({clients,query,setQuery,onNew}:any){const q=query.toLowerCase();const list=clients.filter((c:Client)=>[nameOfClient(c),c.phone,c.email,c.city].join(' ').toLowerCase().includes(q));return <><SearchBar value={query} setValue={setQuery} placeholder="Cerca cliente…" action={<button className="secondary" onClick={onNew}><Plus size={17}/> Nuovo cliente</button>}/><div className="cards">{list.map((c:Client)=><article className="clientCard" key={c.id}><div className="avatar"><ContactRound/></div><div><span className="eyebrow">{c.customer_type}</span><h3>{nameOfClient(c)}</h3><p>{c.phone||'Nessun telefono'}</p><p>{c.email||'Nessuna email'}</p>{c.city&&<small>{c.city}</small>}</div></article>)}</div>{list.length===0&&<Empty text="Nessun cliente trovato."/>}</>}
function Recipes({recipes,onNew}:any){return <><div className="toolbar"><div><span className="eyebrow">ARCHIVIO CUCINA</span><h2 className="sectionTitle">Ricettario</h2></div><button className="secondary" onClick={onNew}><Plus size={17}/> Nuova ricetta</button></div><div className="cards">{recipes.map((r:Recipe)=><article className="dataCard" key={r.id}><div className="iconDisc"><ChefHat/></div><div><span className="eyebrow">{r.category||'Senza categoria'}</span><h3>{r.name}</h3><p>{r.standard_portions} porzioni standard</p><div className="metricLine"><span>Food cost target</span><strong>{r.target_food_cost_percent?`${r.target_food_cost_percent}%`:'—'}</strong></div><div className="metricLine"><span>Prezzo manuale</span><strong>{r.manual_sale_price?euro(r.manual_sale_price):'—'}</strong></div></div></article>)}</div>{recipes.length===0&&<Empty text="Il ricettario è vuoto. Creiamo la prima ricetta."/>}</>}
function Ingredients({ingredients,onNew}:any){return <><div className="toolbar"><div><span className="eyebrow">COSTI</span><h2 className="sectionTitle">Ingredienti</h2></div><button className="secondary" onClick={onNew}><Plus size={17}/> Nuovo ingrediente</button></div><section className="panel tablePanel"><div className="responsiveTable"><table><thead><tr><th>Ingrediente</th><th>Categoria</th><th>Prezzo corrente</th><th>Stato</th></tr></thead><tbody>{ingredients.map((i:Ingredient)=><tr key={i.id}><td><strong>{i.name}</strong></td><td>{i.category||'—'}</td><td>{euro(i.current_price)}</td><td>{i.active?'Attivo':'Disattivato'}</td></tr>)}</tbody></table></div>{ingredients.length===0&&<Empty text="Nessun ingrediente registrato."/>}</section></>}
function Reports({events}:any){const closed=events.filter((e:EventRow)=>['eseguito','chiuso'].includes(e.status));const totalGuests=closed.reduce((a:number,e:EventRow)=>a+e.adults+e.children+e.baby,0);const theoretical=closed.reduce((a:number,e:EventRow)=>a+(Number(e.price_per_adult||0)*e.adults),0);return <><div className="hero compact"><div><span className="eyebrow">ANALISI</span><h2>Report operativi</h2><p>La base è pronta per food cost, produzione e marginalità evento.</p></div></div><div className="stats"><Stat label="Eventi eseguiti" value={closed.length}/><Stat label="Ospiti serviti" value={totalGuests}/><div className="stat"><span>Ricavo teorico adulti</span><strong className="money">{euro(theoretical)}</strong></div></div><section className="panel"><div className="panelHead"><div><span className="eyebrow">PROSSIMO MODULO</span><h3>Produzione cucina</h3></div></div><p className="bodyText">Quando collegheremo i menu alle ricette, questa sezione potrà aggregare automaticamente tutte le preparazioni e gli ingredienti necessari per qualsiasi intervallo di date.</p></section></>}

function EventModal({clients,event,onClose,onSaved}:any){const [form,setForm]=useState({client_id:event?.client_id||'',title:event?.title||'',event_date:event?.event_date||new Date().toISOString().slice(0,10),service:event?.service||'cena',event_type:event?.event_type||'',adults:event?.adults??0,children:event?.children??0,baby:event?.baby??0,status:event?.status||'bozza',location:event?.location||'',room:event?.room||'',price_per_adult:event?.price_per_adult??'',deposit_amount:event?.deposit_amount??0,internal_notes:event?.internal_notes||''});const [saving,setSaving]=useState(false);async function save(e:FormEvent){e.preventDefault();if(!supabase)return;setSaving(true);const payload={...form,adults:Number(form.adults),children:Number(form.children),baby:Number(form.baby),price_per_adult:form.price_per_adult===''?null:Number(form.price_per_adult),deposit_amount:Number(form.deposit_amount)};const res=event?await supabase.from('events').update(payload).eq('id',event.id):await supabase.from('events').insert(payload);setSaving(false);if(!res.error){await onSaved();onClose()}else alert(res.error.message)}return <Modal title={event?`Evento #${event.event_number}`:'Nuovo evento'} onClose={onClose} wide><form onSubmit={save} className="formGrid"><label className="span2">Cliente<select value={form.client_id} onChange={e=>setForm({...form,client_id:e.target.value})}><option value="">Seleziona cliente</option>{clients.map((c:Client)=><option key={c.id} value={c.id}>{nameOfClient(c)}</option>)}</select></label><label className="span2">Titolo / riferimento<input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Es. Matrimonio Rossi"/></label><label>Data<input type="date" value={form.event_date} onChange={e=>setForm({...form,event_date:e.target.value})} required/></label><label>Servizio<select value={form.service} onChange={e=>setForm({...form,service:e.target.value})}><option value="pranzo">Pranzo</option><option value="cena">Cena</option><option value="altro">Altro</option></select></label><label>Tipologia<input value={form.event_type} onChange={e=>setForm({...form,event_type:e.target.value})} placeholder="Matrimonio, aziendale…"/></label><label>Stato<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>{Object.entries(statusLabel).map(([k,v])=><option value={k} key={k}>{v}</option>)}</select></label><label>Adulti<input type="number" min="0" value={form.adults} onChange={e=>setForm({...form,adults:e.target.value as any})}/></label><label>Bambini<input type="number" min="0" value={form.children} onChange={e=>setForm({...form,children:e.target.value as any})}/></label><label>Baby<input type="number" min="0" value={form.baby} onChange={e=>setForm({...form,baby:e.target.value as any})}/></label><label>Prezzo adulto €<input type="number" step="0.01" min="0" value={form.price_per_adult} onChange={e=>setForm({...form,price_per_adult:e.target.value as any})}/></label><label>Acconto €<input type="number" step="0.01" min="0" value={form.deposit_amount} onChange={e=>setForm({...form,deposit_amount:e.target.value as any})}/></label><label>Location<input value={form.location} onChange={e=>setForm({...form,location:e.target.value})}/></label><label>Sala<input value={form.room} onChange={e=>setForm({...form,room:e.target.value})}/></label><label className="span2">Note interne<textarea rows={4} value={form.internal_notes} onChange={e=>setForm({...form,internal_notes:e.target.value})}/></label><div className="formActions span2"><button type="button" className="ghost" onClick={onClose}>Annulla</button><button className="primary" disabled={saving}>{saving?'Salvataggio…':'Salva evento'}</button></div></form></Modal>}
function ClientModal({onClose,onSaved}:any){const [f,setF]=useState({customer_type:'privato',first_name:'',last_name:'',company_name:'',phone:'',email:'',city:'',notes:''});async function save(e:FormEvent){e.preventDefault();const {error}=await supabase!.from('clients').insert(f);if(error)return alert(error.message);await onSaved();onClose()}return <Modal title="Nuovo cliente" onClose={onClose}><form onSubmit={save} className="formGrid"><label className="span2">Tipo<select value={f.customer_type} onChange={e=>setF({...f,customer_type:e.target.value})}><option value="privato">Privato</option><option value="azienda">Azienda</option></select></label><label>Nome<input value={f.first_name} onChange={e=>setF({...f,first_name:e.target.value})}/></label><label>Cognome<input value={f.last_name} onChange={e=>setF({...f,last_name:e.target.value})}/></label><label className="span2">Ragione sociale<input value={f.company_name} onChange={e=>setF({...f,company_name:e.target.value})}/></label><label>Telefono<input value={f.phone} onChange={e=>setF({...f,phone:e.target.value})}/></label><label>Email<input type="email" value={f.email} onChange={e=>setF({...f,email:e.target.value})}/></label><label className="span2">Città<input value={f.city} onChange={e=>setF({...f,city:e.target.value})}/></label><label className="span2">Note<textarea rows={3} value={f.notes} onChange={e=>setF({...f,notes:e.target.value})}/></label><div className="formActions span2"><button type="button" className="ghost" onClick={onClose}>Annulla</button><button className="primary">Salva cliente</button></div></form></Modal>}
function IngredientModal({onClose,onSaved}:any){const [f,setF]=useState({name:'',category:'',current_price:''});async function save(e:FormEvent){e.preventDefault();const {error}=await supabase!.from('ingredients').insert({name:f.name,category:f.category||null,current_price:Number(f.current_price||0),current_price_date:new Date().toISOString().slice(0,10)});if(error)return alert(error.message);await onSaved();onClose()}return <Modal title="Nuovo ingrediente" onClose={onClose}><form onSubmit={save} className="formGrid"><label className="span2">Nome<input required value={f.name} onChange={e=>setF({...f,name:e.target.value})}/></label><label>Categoria<input value={f.category} onChange={e=>setF({...f,category:e.target.value})}/></label><label>Prezzo corrente €<input type="number" step="0.0001" min="0" value={f.current_price} onChange={e=>setF({...f,current_price:e.target.value})}/></label><div className="formActions span2"><button type="button" className="ghost" onClick={onClose}>Annulla</button><button className="primary">Salva ingrediente</button></div></form></Modal>}
function RecipeModal({onClose,onSaved}:any){const [f,setF]=useState({name:'',category:'',standard_portions:'1',target_food_cost_percent:'30',manual_sale_price:''});async function save(e:FormEvent){e.preventDefault();const {error}=await supabase!.from('recipes').insert({name:f.name,category:f.category||null,standard_portions:Number(f.standard_portions),target_food_cost_percent:f.target_food_cost_percent?Number(f.target_food_cost_percent):null,manual_sale_price:f.manual_sale_price?Number(f.manual_sale_price):null});if(error)return alert(error.message);await onSaved();onClose()}return <Modal title="Nuova ricetta" onClose={onClose}><form onSubmit={save} className="formGrid"><label className="span2">Nome piatto<input required value={f.name} onChange={e=>setF({...f,name:e.target.value})}/></label><label className="span2">Categoria<input value={f.category} onChange={e=>setF({...f,category:e.target.value})} placeholder="Antipasto, Primo…"/></label><label>Porzioni standard<input type="number" min="0.01" step="0.01" value={f.standard_portions} onChange={e=>setF({...f,standard_portions:e.target.value})}/></label><label>Food cost target %<input type="number" min="1" max="100" step="0.1" value={f.target_food_cost_percent} onChange={e=>setF({...f,target_food_cost_percent:e.target.value})}/></label><label className="span2">Prezzo vendita manuale €<input type="number" min="0" step="0.01" value={f.manual_sale_price} onChange={e=>setF({...f,manual_sale_price:e.target.value})}/></label><div className="formActions span2"><button type="button" className="ghost" onClick={onClose}>Annulla</button><button className="primary">Salva ricetta</button></div></form></Modal>}
