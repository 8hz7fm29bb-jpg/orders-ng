from pathlib import Path

p = Path('app/page.tsx')
s = p.read_text()
old = '<label>Categoria<input value={f.category} onChange={e=>setF({...f,category:e.target.value})}/></label>'
new = '<label>Categoria<select value={f.category} onChange={e=>setF({...f,category:e.target.value})}><option value="">Seleziona</option><option value="Fresco">Fresco</option><option value="Gelo">Gelo</option><option value="Ambiente">Ambiente</option></select></label>'
if old not in s:
    raise SystemExit('Campo Categoria atteso non trovato: nessuna modifica eseguita')
p.write_text(s.replace(old, new, 1))
