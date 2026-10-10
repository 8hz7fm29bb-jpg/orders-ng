import { Plus, Trash2 } from 'lucide-react'
import { Preparation, preparationCost } from '@/lib/preparations'
export type PreparationDraft = { preparation_id: string; quantity_grams: string }
export function PreparationEditor({ lines, onChange, preparations, standardPortions = 1 }: { lines: PreparationDraft[]; onChange: (value: PreparationDraft[]) => void; preparations: Preparation[]; standardPortions?: number }) {
  return <section className="compositionBox preparationComposition">
    <div className="compositionHead"><div><span className="eyebrow">PREPARAZIONI COLLEGATE</span><h3>Preparazioni di base</h3></div><button type="button" className="secondary" disabled={!preparations.length} onClick={() => onChange([...lines, { preparation_id: '', quantity_grams: '' }])}><Plus size={16}/> Preparazione</button></div>
    <p className="preparationHint">Seleziona la preparazione e i grammi per porzione. Gli ingredienti della base vanno inseriti nella sua ricetta, senza ripeterli qui.</p>
    {!preparations.length && <p className="preparationHint">Crea prima una ricetta nella sezione Preparazioni di base.</p>}
    {lines.map((line, index) => { const prep = preparations.find(p => p.id === line.preparation_id); return <div className="preparationEditorRow" key={index}>
      <label>Preparazione<select required value={line.preparation_id} onChange={e => onChange(lines.map((l, i) => i === index ? { ...l, preparation_id: e.target.value } : l))}><option value="">Seleziona preparazione di base</option>{preparations.filter(p => p.id === line.preparation_id || !lines.some(l => l.preparation_id === p.id)).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label>Grammi per porzione<input required type="number" min="0.001" step="0.001" value={line.quantity_grams} onChange={e => onChange(lines.map((l, i) => i === index ? { ...l, quantity_grams: e.target.value } : l))}/></label>
      <div className="preparationLineCost"><small>Costo per porzione</small><strong>{prep ? (preparationCost({ preparation_id: prep.id, preparation: prep, quantity_grams: Number(line.quantity_grams) }) / standardPortions).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }) : '—'}</strong>{prep?.yield_estimated && <small>Resa da confermare</small>}</div>
      <button type="button" className="deleteLine" aria-label="Rimuovi preparazione" onClick={() => onChange(lines.filter((_, i) => i !== index))}><Trash2 size={16}/></button>
    </div> })}
  </section>
}
