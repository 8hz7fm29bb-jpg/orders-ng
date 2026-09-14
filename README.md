# Orders NG V1

Frontend Next.js + Supabase per il nuovo gestionale Orders NG.

## Cosa include
- Login Supabase
- Dashboard operativa
- Eventi: elenco, creazione e modifica
- Clienti: elenco e creazione
- Ricettario: elenco e creazione base
- Ingredienti: elenco e creazione base
- Report: prima struttura
- Layout responsive Mac / iPad / iPhone
- Web app installabile dalla Home di iPad tramite Safari

## 1. Variabili Supabase
Crea un file `.env.local` nella cartella del progetto copiando `.env.example` e inserisci:

```
NEXT_PUBLIC_SUPABASE_URL=https://...supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Usare **solo** la Publishable key. Non inserire mai Secret key / service_role nel frontend.

## 2. Creare il primo utente
Nel progetto Supabase aprire:
Authentication -> Users -> Add user

Inserire email e password dell'utente che deve accedere a Orders NG.

Le tabelle create in precedenza accettano gli utenti `authenticated`, quindi senza login i dati non sono leggibili.

## 3. Avvio sul Mac
Da Terminale, nella cartella del progetto:

```
npm install
npm run dev
```

Poi aprire `http://localhost:3000`.

## 4. Pubblicazione Vercel
1. Caricare questo progetto in un repository GitHub oppure importarlo su Vercel.
2. In Vercel -> Project -> Settings -> Environment Variables aggiungere:
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
3. Fare Deploy.
4. Aprire l'URL Vercel da Safari su Mac/iPad.

## Importante
Questa V1 usa la struttura database già creata in Supabase. Il prossimo modulo previsto è:
**Menu evento -> ingredienti ricetta -> food cost automatico -> prezzo suggerito -> preventivo PDF -> produzione cucina**.
