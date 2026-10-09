'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowDown, ArrowUp, FileText, Plus, Save, Trash2 } from 'lucide-react'
import { Modal } from './Modal'
import { loadRecipes, supabase, type MenuRecipeOption } from '@/lib/supabase'
import { menuBase, quotePrice, scaleMenu, type QuoteLine, type QuoteTemplate } from '@/lib/quick-quote'
import type { EventPdfData } from '@/lib/event-pdf'
import '@/app/quick-quote.css'

type QuoteClient = { id: string; client_number?: number | null; first_name: string | null; last_name: string | null; company_name: string | null; phone: string | null; email: string | null }
const clientName = (client: QuoteClient) => client.company_name || [client.first_name?.trim(), client.last_name?.trim()].filter(Boolean).join(' ')
const clientChoice = (client: QuoteClient) => `${clientName(client)} · #${client.client_number || client.id.slice(0, 8)}`
const euro = (price: number) => price.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })

export function QuickQuote({ clients, onClose, onSaved }: { clients: QuoteClient[]; onClose: () => void; onSaved: () => Promise<void> }) {
  const [template, setTemplate] = useState<QuoteTemplate | null>(null)
  const [recipes, setRecipes] = useState<MenuRecipeOption[]>([])
  const [adultLines, setAdultLines] = useState<QuoteLine[]>([])
  const [babyLines, setBabyLines] = useState<QuoteLine[]>([])
  const [adults, setAdults] = useState(0), [baby, setBaby] = useState(0)
  const [adultCorrection, setAdultCorrection] = useState('0'), [babyCorrection, setBabyCorrection] = useState('0')
  const [customer, setCustomer] = useState(''), [phone, setPhone] = useState('')
  const [date, setDate] = useState(''), [service, setService] = useState('')
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false)
  const [error, setError] = useState(''), [message, setMessage] = useState('')
  const [preview, setPreview] = useState<{ url: string; filename: string } | null>(null)
  const previewUrl = useRef<string | null>(null), actionLock = useRef(false), requestId = useRef<string | null>(null)
  const previewClose = useRef<HTMLButtonElement | null>(null), returnFocus = useRef<HTMLElement | null>(null)
  const savedClient = useRef<{ choice: string; client: QuoteClient } | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!supabase) throw new Error('Connessione non disponibile.')
      const [saved, catalog] = await Promise.all([supabase.from('quick_quote_templates').select('payload').eq('id', 'default').single(), loadRecipes()])
      if (saved.error) throw saved.error
      if (catalog.error) throw new Error(catalog.error)
      if (cancelled) return
      const stored = saved.data.payload as QuoteTemplate
      const hydrate = (lines: QuoteLine[]) => lines.map(line => ({ ...line, sale_price: catalog.recipes.find(r => r.id === line.recipe_id)?.sale_price ?? line.sale_price }))
      const initial: QuoteTemplate = { ...stored, adult_lines: scaleMenu(hydrate(stored.adult_lines), stored.adults), baby_lines: scaleMenu(hydrate(stored.baby_lines), stored.baby) }
      setTemplate(initial); setRecipes(catalog.recipes)
      setAdults(initial.adults); setBaby(initial.baby)
      setAdultLines(scaleMenu(initial.adult_lines, initial.adults)); setBabyLines(scaleMenu(initial.baby_lines, initial.baby))
      setLoading(false)
    }
    void load().catch(e => { if (!cancelled) { setError(e.message || 'Impossibile caricare il menu predefinito.'); setLoading(false) } })
    return () => { cancelled = true }
  }, [])
  useEffect(() => () => { if (previewUrl.current) URL.revokeObjectURL(previewUrl.current) }, [])
  function closePreview() { setPreview(null); returnFocus.current?.focus() }
  useEffect(() => {
    if (!preview) return
    previewClose.current?.focus()
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); closePreview() } }
    window.addEventListener('keydown', escape, true)
    return () => window.removeEventListener('keydown', escape, true)
  }, [preview])

  const nameMatches = clients.filter(c => clientName(c).toLocaleLowerCase('it-IT') === customer.trim().toLocaleLowerCase('it-IT'))
  const selectedClient = clients.find(c => clientChoice(c) === customer) || (nameMatches.length === 1 ? nameMatches[0] : null) || (savedClient.current?.choice === customer ? savedClient.current.client : null)
  const numericCorrection = (value: string) => Number(value.replace(',', '.'))
  const adultPrice = template ? quotePrice(adultLines, template.adult_lines, template.adult_price) + numericCorrection(adultCorrection) : 0
  const babyPrice = template ? quotePrice(babyLines, template.baby_lines, template.baby_price) + numericCorrection(babyCorrection) : 0
  const validMenu = adultLines.length > 0 && [...adultLines, ...(baby > 0 ? babyLines : [])].every(l => recipes.some(r => r.id === l.recipe_id) && Number.isFinite(l.portion_ratio) && l.portion_ratio >= 0)

  function counts(audience: 'adult' | 'baby', count: number) {
    if (audience === 'adult') { setAdults(count); setAdultLines(lines => scaleMenu(lines, count)) }
    else { setBaby(count); setBabyLines(lines => scaleMenu(lines, count)) }
  }
  async function saveTemplate() {
    if (!supabase || !template || actionLock.current || !validMenu) return
    if (!Number.isInteger(adults) || adults < 1 || !Number.isInteger(baby) || baby < 0) { setError('Controlla il numero di adulti e baby.'); return }
    if (![adultPrice, babyPrice].every(p => Number.isFinite(p) && p >= 0)) { setError('Controlla prezzi e correttivi.'); return }
    actionLock.current = true; setBusy(true); setError(''); setMessage('')
    try {
      const next: QuoteTemplate = { version: 1, adults, baby, adult_price: adultPrice, baby_price: babyPrice, adult_lines: adultLines, baby_lines: babyLines }
      const result = await supabase.from('quick_quote_templates').update({ payload: next, updated_at: new Date().toISOString() }).eq('id', 'default').select('id').single()
      if (result.error) throw result.error
      setTemplate(next); setAdultCorrection('0'); setBabyCorrection('0'); setMessage('Menu predefinito aggiornato.')
    } catch (e) { setError(e instanceof Error ? e.message : (e as { message: string }).message) }
    finally { actionLock.current = false; setBusy(false) }
  }
  async function saveQuote(generatePdf: boolean) {
    if (!supabase || !template || actionLock.current) return
    const form = document.getElementById('quickQuoteForm') as HTMLFormElement
    if (!form.reportValidity()) return
    if (!selectedClient && nameMatches.length > 1) { setError('Più clienti hanno questo nome: scegli la scheda corretta dai suggerimenti.'); return }
    if (!validMenu || (baby > 0 && !babyLines.length)) { setError('Seleziona una ricetta per ogni portata, anche nel menu baby.'); return }
    if (![adultPrice, babyPrice].every(p => Number.isFinite(p) && p >= 0)) { setError('Controlla prezzi e correttivi.'); return }
    const standalone = window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
    const pdfWindow = generatePdf && !standalone ? window.open('', '_blank') : null
    if (pdfWindow) { pdfWindow.document.title = 'Generazione PDF'; pdfWindow.document.body.textContent = 'Generazione PDF in corso…' }
    returnFocus.current = document.activeElement as HTMLElement
    actionLock.current = true; setBusy(true); setError(''); setMessage('')
    try {
      requestId.current ||= crypto.randomUUID()
      const quote = { client_id: selectedClient?.id || null, client_name: customer.trim(), phone: selectedClient ? null : phone.trim(), event_date: date, service, adults, baby, price_per_adult: adultPrice, price_per_baby: babyPrice, price_adjustment: adultPrice - menuBase(adultLines), baby_price_adjustment: babyPrice - menuBase(babyLines), adult_lines: adultLines, baby_lines: baby > 0 ? babyLines : [] }
      const { data, error: failure } = await supabase.rpc('save_quick_quote', { p_request_id: requestId.current, p_quote: quote })
      if (failure) throw failure
      const client = data.client as QuoteClient
      savedClient.current = { choice: customer, client }
      setMessage(`Preventivo salvato: evento #${data.event_number}.`)
      await onSaved()
      if (generatePdf) {
        const event: EventPdfData = { event_number: data.event_number, event_date: date, service, adults, baby, price_per_adult: adultPrice, price_per_baby: babyPrice, internal_notes: '', celiac_count: 0, vegan_count: 0, vegetarian_count: 0, lactose_free_count: 0, client }
        const { downloadEventPdf } = await import('@/lib/event-pdf')
        const result = await downloadEventPdf({ kind: 'quote', event, preview: pdfWindow }, adultLines, baby > 0 ? babyLines : [], recipes)
        if (result) { if (previewUrl.current) URL.revokeObjectURL(previewUrl.current); previewUrl.current = result.url; setPreview(result) }
      }
    } catch (e) { pdfWindow?.close(); setError(e instanceof Error ? e.message : (e as { message: string }).message) }
    finally { actionLock.current = false; setBusy(false) }
  }
  function block(audience: 'adult' | 'baby') {
    const isAdult = audience === 'adult', lines = isAdult ? adultLines : babyLines, count = isAdult ? adults : baby
    const setLines = isAdult ? setAdultLines : setBabyLines
    function update(index: number, patch: Partial<QuoteLine>) { setLines(current => current.map((line, i) => i === index ? { ...line, ...patch } : line)) }
    function move(index: number, direction: number) { setLines(current => { const next = [...current]; [next[index], next[index + direction]] = [next[index + direction], next[index]]; return next }) }
    return <section className="compositionBox eventMenuBlock"><div className="compositionHead"><div><span className="eyebrow">{isAdult ? 'MENU ADULTI' : 'MENU BABY'}</span><h3>Portate <small className="menuGuestCount">· {count} ospiti</small></h3></div><button type="button" className="secondary" onClick={() => setLines(current => [...current, { recipe_id: '', course_type: 'other', sale_price: 0, portion_ratio: 1, portions: count }])}><Plus size={16} /> Aggiungi portata</button></div><div className="eventMenuLines"><div className="eventMenuLine eventMenuHeader"><span>Ricetta</span><span>Categoria</span><span>Porzioni</span><span>Prezzo</span><span /></div>{lines.map((line, index) => { const recipe = recipes.find(r => r.id === line.recipe_id); return <div className="eventMenuLine" key={index}><select aria-label={`Ricetta ${isAdult ? 'adulti' : 'baby'} ${index + 1}`} value={line.recipe_id} onChange={e => { const r = recipes.find(r => r.id === e.target.value); update(index, { recipe_id: e.target.value, course_type: r?.category || 'other', sale_price: r?.sale_price || 0 }) }}><option value="">Seleziona ricetta</option>{!recipe && line.recipe_id && <option value={line.recipe_id}>Ricetta non disponibile: scegli una sostituzione</option>}{recipes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select><strong>{recipe?.category || line.course_type}</strong><input aria-label={`Porzioni ${isAdult ? 'adulti' : 'baby'} ${index + 1}`} className="menuPortionsInput" type="number" min="0" step="0.01" value={line.portions ?? 0} disabled={count === 0} onChange={e => { const portions = Number(e.target.value); update(index, { portions, portion_ratio: count > 0 ? portions / count : line.portion_ratio }) }} /><strong className="menuPrice">{euro(line.sale_price || 0)}</strong><div className="menuLineActions"><button type="button" className="ghost" aria-label="Sposta portata su" disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={14} /></button><button type="button" className="ghost" aria-label="Sposta portata giù" disabled={index === lines.length - 1} onClick={() => move(index, 1)}><ArrowDown size={14} /></button><button type="button" className="deleteLine" aria-label="Elimina portata" onClick={() => setLines(current => current.filter((_, i) => i !== index))}><Trash2 size={16} /></button></div></div> })}</div><small className="fieldHint">Le porzioni si adattano agli ospiti e possono essere modificate singolarmente.</small></section>
  }
  return <Modal title="Preventivo rapido" onClose={() => { if (!actionLock.current) onClose() }} wide>
    <div className="quickQuoteIntro"><span className="eyebrow">MENU BANCHETTO PRECARICATO</span><p>Inserisci cliente, data e servizio. Controlla ospiti e prezzi, poi genera il preventivo.</p></div>
    {loading ? <div className="empty">Caricamento menu predefinito…</div> : template && <>
      <form id="quickQuoteForm" className="formGrid eventForm quickQuoteForm" onSubmit={(e: FormEvent) => { e.preventDefault(); void saveQuote(true) }}>
        <fieldset disabled={busy}><label className="span2">Cliente<input aria-label="Cliente" autoFocus required value={customer} list="quickQuoteClients" placeholder="Cerca un cliente o scrivi un nuovo nome" onChange={e => setCustomer(e.target.value)} /><datalist id="quickQuoteClients">{clients.map(c => <option key={c.id} value={clientChoice(c)} />)}</datalist><small className="fieldHint">{selectedClient ? 'Cliente già presente in archivio.' : 'Il nuovo cliente sarà aggiunto all’archivio.'}</small></label>
        {!selectedClient && <label className="span2">Telefono <small>(facoltativo)</small><input type="tel" value={phone} onChange={e => setPhone(e.target.value)} /></label>}
        <div className="quickQuoteDetails"><label>Data<input type="date" required value={date} onChange={e => setDate(e.target.value)} /></label><label>Servizio<select aria-label="Servizio" required value={service} onChange={e => setService(e.target.value)}><option value="">Seleziona</option><option value="pranzo">Pranzo</option><option value="cena">Cena</option><option value="altro">Altro</option></select></label><label>Adulti<input type="number" min="1" step="1" required value={adults} onChange={e => counts('adult', Math.max(0, Number(e.target.value)))} /></label><label>Baby<input type="number" min="0" step="1" required value={baby} onChange={e => counts('baby', Math.max(0, Number(e.target.value)))} /></label></div>
        <div className="quickQuotePrices"><section className="eventPriceGroup"><h4>MENU ADULTI</h4><div className="eventPriceFields"><label>Prezzo per persona<input readOnly value={Number.isFinite(adultPrice) ? euro(adultPrice) : '—'} /></label><label>Correttivo €<input inputMode="decimal" value={adultCorrection} onChange={e => setAdultCorrection(e.target.value)} /></label></div></section><section className="eventPriceGroup"><h4>MENU BABY</h4><div className="eventPriceFields"><label>Prezzo per baby<input readOnly value={Number.isFinite(babyPrice) ? euro(babyPrice) : '—'} /></label><label>Correttivo €<input inputMode="decimal" value={babyCorrection} onChange={e => setBabyCorrection(e.target.value)} /></label></div></section></div></fieldset>
      </form>
      <div className="quickQuoteActions"><button type="button" className="secondary" disabled={busy || !validMenu} onClick={() => void saveTemplate()}><Save size={16} /> Salva come menu predefinito</button><button type="button" className="secondary" disabled={busy} onClick={() => void saveQuote(false)}>Salva preventivo</button><button type="submit" form="quickQuoteForm" className="primary" disabled={busy || !validMenu}><FileText size={17} /> {busy ? 'Elaborazione…' : 'Genera preventivo'}</button></div>
      <fieldset className="quickQuoteMenus" disabled={busy}>{block('adult')}{baby > 0 && block('baby')}</fieldset>
    </>}
    {error && <div className="errorBox quickQuoteNotice" role="alert">{error}</div>}{message && <div className="quickQuoteSuccess quickQuoteNotice" role="status">{message}</div>}
    {preview && createPortal(<section className="eventPdfPreview eventPdfFullscreen" role="dialog" aria-modal="true" aria-label="Anteprima preventivo"><div className="eventPdfPreviewActions"><strong>Preventivo pronto</strong><a className="secondary" href={preview.url} download={preview.filename}>Scarica PDF</a><a className="secondary" href={preview.url} target="_blank" rel="noopener">Apri PDF</a><button ref={previewClose} className="secondary" onClick={closePreview}>Torna al preventivo</button></div><iframe title={preview.filename} src={preview.url} /></section>, document.body)}
  </Modal>
}
