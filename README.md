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
