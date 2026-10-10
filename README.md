# Orders NG V2

Aggiornamento del modulo cucina/food cost.

## Novità
- Ricette modificabili.
- Ogni ricetta richiama ingredienti dall'anagrafica.
- Quantità e unità di misura per ogni ingrediente in ricetta.
- Ingredienti con prezzo legato all'unità di misura (€/kg, €/L, €/pz, ecc.).
- Conversioni automatiche kg/g e L/ml nel calcolo del food cost.
- Costo totale ricetta, costo per porzione e prezzo di vendita consigliato.
- Modifica degli ingredienti e storico prezzo quando il prezzo cambia.

## Pubblicazione
Caricare il contenuto di questa cartella nella radice del repository GitHub `orders-ng`, sostituendo i file esistenti. Fare Commit changes. Vercel, già collegato al repository, avvierà automaticamente un nuovo deployment.

Non modificare le Environment Variables su Vercel e non è necessario modificare il database Supabase: la struttura già creata contiene `units`, `ingredients`, `ingredient_prices`, `recipes` e `recipe_ingredients`.

## Salse e creme (ottobre 2026)
- Ricettario: terza raccolta `Salse e creme`, con categorie Primi e Dessert.
- Ingredienti della base e resa finale in grammi; le rese iniziali sono teoriche e vanno confermate in cucina.
- Scheda del piatto: collegamenti alle preparazioni con grammi per porzione, distinti dagli ingredienti diretti.
- Report: `Salse e creme` aggrega il prodotto finito e ne mostra ingredienti e destinazioni. Piatti mostra solo il richiamo alla base; Ingredienti raggruppati e Aggregatore ne espandono la composizione.
- Costi e prezzi calcolati includono le preparazioni. La cucina mantiene l'accesso in sola lettura.
- Salvataggio tramite `save_recipe_with_composition` (SECURITY INVOKER) atomico per ricetta, ingredienti e collegamenti.
- Le migrazioni `recipe_preparations` e `seed_initial_preparations` vanno applicate prima e dopo la pubblicazione rispettivamente. Il seed estrae solo composizioni identiche e verifica che ogni quantità originale rimanga invariata.
- Verifica: `node tests/preparations.cjs`, `node tests/quick-quote.cjs`, `npm run test:rch`, `npm run build`.
