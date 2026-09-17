from pathlib import Path
import re

page = Path('app/page.tsx')
s = page.read_text()

# Mantiene le modifiche evento gia applicate e aggiorna solo il badge ricetta di Impatto Modifica.
old = '''<div className="ingredientImpactRecipe" key={r.id}><div><strong>{r.name}</strong>{r.category&&<small>{r.category}</small>}</div></div>'''
new = '''<div className="ingredientImpactRecipe" key={r.id}><span className="ingredientRecipeInitial" aria-hidden="true">{(r.name||'?').trim().charAt(0).toLocaleUpperCase('it-IT')}</span><div><strong>{r.name}</strong>{r.category&&<small>{r.category}</small>}</div></div>'''
if old not in s:
    raise SystemExit('Riga ricetta Impatto Modifica non trovata')
s = s.replace(old, new, 1)
page.write_text(s)
