"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  compatible,
  normalizeName,
  readRchFile,
  rchUnit,
  type RchRow,
  type RchMapping,
  type RchImport,
} from "@/lib/rch";
import catalog from "@/lib/rch-catalog.json";
type Ingredient = {
  id: string;
  name: string;
  active: boolean;
  unit?: { code: string } | null;
};
type Unit = { id: string; code: string; name: string };
export async function loadRchImports() {
  const r = await supabase!
    .from("rch_imports")
    .select("*")
    .order("period_to", { ascending: false });
  if (r.error) throw new Error(r.error.message);
  return r.data as RchImport[];
}
export function RchConsumptions({
  ingredients,
  units,
  onCreated,
}: {
  ingredients: Ingredient[];
  units: Unit[];
  onCreated: () => Promise<void>;
}) {
  const [tab, setTab] = useState("import"),
    [mappings, setMappings] = useState<RchMapping[]>([]),
    [imports, setImports] = useState<RchImport[]>([]),
    [rows, setRows] = useState<RchRow[]>([]),
    [filename, setFilename] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [query, setQuery] = useState(""),
    [detail, setDetail] = useState<RchImport | null>(null),
    [replace, setReplace] = useState("");
  async function refresh() {
    const [m, i] = await Promise.all([
      supabase!.from("rch_mappings").select("*").order("name"),
      loadRchImports(),
    ]);
    if (m.error) throw new Error(m.error.message);
    setMappings(m.data as RchMapping[]);
    setImports(i);
  }
  useEffect(() => {
    refresh().catch((e) => setMessage(e.message));
  }, []);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await fn();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Operazione non riuscita.");
    } finally {
      setBusy(false);
    }
  }
  async function openFile(file: File) {
    await run(async () => {
      const parsed = await readRchFile(file);
      setRows(parsed);
      setFilename(file.name);
      const existing = new Map(mappings.map((m) => [m.rch_id, m]));
      const newRows = parsed
        .filter((r) => !existing.has(r.rch_id))
        .map((r) => ({
          rch_id: r.rch_id,
          name: r.name,
          unit_code: r.unit_code,
          ingredient_id: null,
          excluded: /^vin[oi]\b/i.test(r.name),
        }));
      if (newRows.length) {
        const r = await supabase!
          .from("rch_mappings")
          .upsert(newRows, { onConflict: "rch_id", ignoreDuplicates: true });
        if (r.error) throw new Error(r.error.message);
        await refresh();
      }
      setMessage(
        "File letto. Controlla le associazioni e indica il periodo prima di salvare.",
      );
    });
  }
  async function change(m: RchMapping, patch: Partial<RchMapping>) {
    await run(async () => {
      const r = await supabase!
        .from("rch_mappings")
        .update(patch)
        .eq("rch_id", m.rch_id)
        .select()
        .single();
      if (r.error) throw new Error(r.error.message);
      setMappings((old) =>
        old.map((x) => (x.rch_id === m.rch_id ? r.data : x)),
      );
    });
  }
  async function seed() {
    await run(async () => {
      const r = await supabase!.from("rch_mappings").upsert(
        catalog.map((r) => ({
          ...r,
          ingredient_id: null,
          excluded: /^vin[oi]\b/i.test(r.name),
        })),
        { onConflict: "rch_id", ignoreDuplicates: true },
      );
      if (r.error) throw new Error(r.error.message);
      await refresh();
      setTab("associations");
      setMessage(
        "Modello caricato senza quantità. Associa gli ingredienti e contrassegna i vini come esclusi.",
      );
    });
  }
  const byId = new Map(mappings.map((m) => [m.rch_id, m]));
  const valid = (r: RchRow) => {
    const m = byId.get(r.rch_id),
      i = ingredients.find((i) => i.id === m?.ingredient_id);
    return (
      m?.unit_code === r.unit_code &&
      (m.excluded || Boolean(i && compatible(r.unit_code, i.unit?.code)))
    );
  };
  const unresolved = rows.filter((r) => !valid(r));
  async function save() {
    await run(async () => {
      if (!from || !to || from > to || !rows.length)
        throw new Error("Indica un periodo valido e carica il file.");
      if (unresolved.length)
        throw new Error(
          "Completa le associazioni o escludi tutte le voci evidenziate.",
        );
      const canonical = JSON.stringify(
        rows.map((r) => [r.rch_id, r.unit_code, r.quantity]),
      );
      const hash = Array.from(
        new Uint8Array(
          await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(canonical),
          ),
        ),
      )
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      const payload = {
        filename,
        period_from: from,
        period_to: to,
        file_hash: hash,
        rows,
        mappings: rows.map((r) => byId.get(r.rch_id)!),
      };
      if (
        replace &&
        !confirm("Sostituire il resoconto selezionato con questo file?")
      )
        return;
      const r = replace
        ? await supabase!
            .from("rch_imports")
            .update(payload)
            .eq("id", replace)
            .select()
            .single()
        : await supabase!.from("rch_imports").insert(payload).select().single();
      if (r.error)
        throw new Error(
          r.error.code === "23505"
            ? "Questo resoconto è già stato importato."
            : r.error.code === "23P01"
              ? "Il periodo si sovrappone a un resoconto già importato. Scegli Sostituisci dall’archivio."
              : r.error.message,
        );
      await refresh();
      setRows([]);
      setFilename("");
      setReplace("");
      setTab("archive");
      setMessage("Resoconto salvato.");
    });
  }
  async function createIngredient(m: RchMapping) {
    const name = prompt("Nome del nuovo ingrediente ORDERS", m.name);
    if (!name?.trim()) return;
    const category = prompt("Categoria: Fresco, Gelo o Ambiente", "Ambiente");
    if (!category || !["Fresco", "Gelo", "Ambiente"].includes(category)) return;
    await run(async () => {
      const unit = units.find(
        (u) =>
          u.code ===
          (m.unit_code === 1 ? "kg" : m.unit_code === 3 ? "l" : "pz"),
      );
      if (!unit) throw new Error("Unità ORDERS non disponibile.");
      const r = await supabase!
        .from("ingredients")
        .insert({
          name: name.trim(),
          category,
          unit_id: unit.id,
          current_price: 0,
          active: true,
        })
        .select("id")
        .single();
      if (r.error) throw new Error(r.error.message);
      const u = await supabase!
        .from("rch_mappings")
        .update({ ingredient_id: r.data.id, excluded: false })
        .eq("rch_id", m.rch_id);
      if (u.error) throw new Error(u.error.message);
      await onCreated();
      await refresh();
      setMessage(
        "Ingrediente creato con prezzo 0: aggiorna la quotazione nella sezione Ingredienti.",
      );
    });
  }
  function editor(m: RchMapping) {
    const suggestions = ingredients.filter(
      (i) => i.active && compatible(m.unit_code, i.unit?.code),
    );
    const exact = suggestions.filter(
      (i) => normalizeName(i.name) === normalizeName(m.name),
    );
    return (
      <div className="rchAssociation">
        {byId.get(m.rch_id)?.unit_code !== m.unit_code && (
          <button
            className="secondary"
            disabled={busy}
            onClick={() =>
              change(m, { unit_code: m.unit_code, ingredient_id: null })
            }
          >
            Conferma nuova unità
          </button>
        )}
        <select
          aria-label={`Associazione ${m.name}`}
          disabled={busy || m.excluded}
          value={m.ingredient_id || ""}
          onChange={(e) => change(m, { ingredient_id: e.target.value || null })}
        >
          <option value="">
            Da associare
            {exact.length === 1 ? ` — suggerito: ${exact[0].name}` : ""}
          </option>
          {suggestions.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name} ({i.unit?.code})
            </option>
          ))}
        </select>
        <label>
          <input
            type="checkbox"
            checked={m.excluded}
            disabled={busy}
            onChange={(e) => change(m, { excluded: e.target.checked })}
          />{" "}
          Escluso / vino
        </label>
        {!m.excluded && !m.ingredient_id && (
          <button
            className="secondary"
            disabled={busy}
            onClick={() => createIngredient(m)}
          >
            Crea ingrediente
          </button>
        )}
      </div>
    );
  }
  const visible = (
    tab === "import"
      ? rows.map((r) => ({ ...byId.get(r.rch_id)!, ...r }))
      : mappings
  ).filter((m) =>
    `${m.name} ${m.rch_id}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <div className="toolbar">
        <div className="categoryTabs">
          {[
            ["import", "Importa file"],
            ["archive", "Archivio"],
            ["associations", "Associazioni ingredienti"],
          ].map(([id, label]) => (
            <button
              key={id}
              className={`categoryTab ${tab === id ? "active" : ""}`}
              onClick={() => {
                setTab(id);
                setDetail(null);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {message && (
        <div className="authInfoBox" role="status">
          {message}
        </div>
      )}
      {tab === "import" && (
        <section className="panel rchControls">
          <h3>Resoconto settimanale RCH</h3>
          <p>
            Carica il file completo: ogni ingrediente viene contato una sola
            volta. I vini contrassegnati come esclusi non entrano nella lista
            acquisti.
          </p>
          <label>
            File RCH
            <input
              disabled={busy}
              type="file"
              accept=".numbers,.xlsx,.xls,.csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) openFile(f);
                e.target.value = "";
              }}
            />
          </label>
          <div className="reportDates">
            <label>
              Consumo dal
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>
            <label>
              al
              <input
                type="date"
                min={from}
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </label>
          </div>
          {filename && (
            <p>
              {filename} · {rows.length} ingredienti · {unresolved.length} da
              verificare{replace ? " · Sostituzione resoconto" : ""}
            </p>
          )}
          {rows.some((r) => r.quantity > 0) && (
            <p>Le quantità positive non vengono considerate come consumo.</p>
          )}
          <div className="formActions">
            <button className="secondary" disabled={busy} onClick={seed}>
              Carica modello iniziale senza quantità
            </button>
            <button
              className="primary"
              disabled={
                busy || !rows.length || unresolved.length > 0 || !from || !to
              }
              onClick={save}
            >
              {busy
                ? "Operazione in corso…"
                : replace
                  ? "Sostituisci resoconto"
                  : "Salva resoconto"}
            </button>
          </div>
        </section>
      )}
      {(tab === "associations" || (tab === "import" && rows.length > 0)) && (
        <section className="panel tablePanel">
          <div className="panelHead">
            <h3>
              {tab === "import"
                ? "Anteprima e associazioni"
                : "Associazioni RCH → ORDERS"}
            </h3>
            <input
              aria-label="Cerca ingrediente RCH"
              placeholder="Cerca nome o ID"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {tab === "associations" && (
            <p className="rchHint">
              Le modifiche valgono per le prossime importazioni. Per aggiornare
              un resoconto precedente usa Ricalcola nell’archivio.
            </p>
          )}
          <div className="responsiveTable">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Ingrediente RCH</th>
                  <th>UM</th>
                  {tab === "import" && <th>Da reintegrare</th>}
                  <th>Ingrediente ORDERS / esclusione</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((m) => (
                  <tr key={m.rch_id}>
                    <td>{m.rch_id}</td>
                    <td>{m.name}</td>
                    <td>{rchUnit(m.unit_code)}</td>
                    {tab === "import" && (
                      <td>
                        {Math.max(
                          0,
                          -Number(
                            rows.find((r) => r.rch_id === m.rch_id)?.quantity,
                          ),
                        ).toLocaleString("it-IT")}
                      </td>
                    )}
                    <td>{editor(m)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {tab === "archive" && (
        <section className="panel tablePanel">
          <div className="panelHead">
            <h3>Resoconti importati</h3>
          </div>
          <div className="responsiveTable">
            <table>
              <thead>
                <tr>
                  <th>Periodo</th>
                  <th>File</th>
                  <th>Azioni</th>
                </tr>
              </thead>
              <tbody>
                {imports.map((i) => (
                  <tr key={i.id}>
                    <td>
                      {i.period_from.split("-").reverse().join("/")} —{" "}
                      {i.period_to.split("-").reverse().join("/")}
                    </td>
                    <td>{i.filename}</td>
                    <td>
                      <div className="rchActions">
                        <button
                          className="secondary"
                          onClick={() => setDetail(i)}
                        >
                          Apri
                        </button>
                        <button
                          className="secondary"
                          disabled={busy}
                          onClick={() => {
                            setReplace(i.id);
                            setFrom(i.period_from);
                            setTo(i.period_to);
                            setRows([]);
                            setFilename("");
                            setTab("import");
                          }}
                        >
                          Sostituisci
                        </button>
                        <button
                          className="secondary"
                          disabled={busy}
                          onClick={() =>
                            run(async () => {
                              if (i.rows.some((r) => !valid(r)))
                                throw new Error(
                                  "Completa prima le associazioni attuali.",
                                );
                              if (
                                !confirm(
                                  "Ricalcolare questo resoconto con le associazioni attuali?",
                                )
                              )
                                return;
                              const r = await supabase!
                                .from("rch_imports")
                                .update({
                                  mappings: i.rows.map((r) =>
                                    byId.get(r.rch_id)!,
                                  ),
                                })
                                .eq("id", i.id)
                                .select()
                                .single();
                              if (r.error) throw new Error(r.error.message);
                              setDetail(null);
                              await refresh();
                              setMessage(
                                "Associazioni del resoconto aggiornate.",
                              );
                            })
                          }
                        >
                          Ricalcola
                        </button>
                        <button
                          className="ghost"
                          disabled={busy}
                          onClick={() =>
                            run(async () => {
                              if (!confirm("Eliminare questo resoconto?"))
                                return;
                              const r = await supabase!
                                .from("rch_imports")
                                .delete()
                                .eq("id", i.id);
                              if (r.error) throw new Error(r.error.message);
                              setDetail(null);
                              await refresh();
                            })
                          }
                        >
                          Elimina
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!imports.length && (
              <p className="empty">Nessun resoconto importato.</p>
            )}
          </div>
          {detail && (
            <div className="responsiveTable">
              <h3>{detail.filename}</h3>
              <table>
                <thead>
                  <tr>
                    <th>Ingrediente RCH</th>
                    <th>Saldo</th>
                    <th>UM</th>
                    <th>Associazione salvata</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.rows.map((r) => {
                    const m = detail.mappings.find(
                      (m) => m.rch_id === r.rch_id,
                    );
                    return (
                      <tr key={r.rch_id}>
                        <td>{r.name}</td>
                        <td>{r.quantity.toLocaleString("it-IT")}</td>
                        <td>{rchUnit(r.unit_code)}</td>
                        <td>
                          {m?.excluded
                            ? "Escluso"
                            : ingredients.find((i) => i.id === m?.ingredient_id)
                                ?.name || "Ingrediente non disponibile"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </>
  );
}
