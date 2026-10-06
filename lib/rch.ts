export type RchRow = {
  rch_id: number;
  name: string;
  unit_code: number;
  quantity: number;
};
export type RchMapping = {
  rch_id: number;
  name: string;
  unit_code: number;
  ingredient_id: string | null;
  excluded: boolean;
};
export type RchImport = {
  id: string;
  filename: string;
  period_from: string;
  period_to: string;
  rows: RchRow[];
  mappings: RchMapping[];
  file_hash: string;
  created_at: string;
};
export const rchUnit = (code: number) =>
  ({ 1: "g", 3: "ml", 4: "pz" })[code] || "";
export function normalizeName(name: string) {
  return name
    .trim()
    .toLocaleLowerCase("it")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}
export function parseStock(rows: unknown[][]): RchRow[] {
  const norm = (x: unknown) =>
    String(x ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z]/g, "");
  const h = rows.findIndex(
    (r) =>
      r.some((x) => norm(x) === "quantita") &&
      r.some((x) => norm(x) === "nome") &&
      r.some((x) => norm(x) === "id"),
  );
  if (h < 0)
    throw new Error(
      "Foglio stock non trovato: servono id, nome, unità e quantità.",
    );
  const headers = rows[h].map(norm),
    col = (s: string) => headers.indexOf(s),
    result = new Map<number, RchRow>();
  function num(value: unknown) {
    if (typeof value === "number") return value;
    const s = String(value ?? "").trim();
    if (!s) throw new Error("Quantità o codice mancante.");
    return Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
  }
  for (const cells of rows.slice(h + 1)) {
    if (cells.every((x) => x == null || x === "")) continue;
    const row = {
      rch_id: num(cells[col("id")]),
      name: String(cells[col("nome")] ?? "").trim(),
      unit_code: num(cells[col("unita")]),
      quantity: num(cells[col("quantita")]),
    };
    if (
      !Number.isSafeInteger(row.rch_id) ||
      row.rch_id <= 0 ||
      !row.name ||
      !rchUnit(row.unit_code) ||
      !Number.isFinite(row.quantity)
    )
      throw new Error(
        `Riga non valida: ${row.name || row.rch_id}. Controlla ID, unità e quantità.`,
      );
    const previous = result.get(row.rch_id);
    if (
      previous &&
      (previous.name !== row.name ||
        previous.unit_code !== row.unit_code ||
        previous.quantity !== row.quantity)
    )
      throw new Error(
        `Quantità o dati discordanti per ID ${row.rch_id}: ${row.name}.`,
      );
    result.set(row.rch_id, row);
  }
  if (!result.size) throw new Error("Nessun ingrediente nel file.");
  return [...result.values()].sort((a, b) => a.rch_id - b.rch_id);
}
export async function readRchFile(file: File) {
  if (file.size > 10 * 1024 * 1024) throw new Error("Il file supera 10 MB.");
  const XLSX = await import("xlsx");
  const book = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const sheet =
    book.SheetNames.find((n) => n.toLowerCase().trim() === "stock") ||
    book.SheetNames.find((n) => {
      const rows = XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[n], {
        header: 1,
      });
      return rows.some((r) => r.includes("nome") && r.includes("id"));
    });
  if (!sheet) throw new Error("Il file non contiene il foglio stock RCH.");
  return parseStock(
    XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[sheet], {
      header: 1,
      defval: null,
    }),
  );
}
export function compatible(code: number, unit?: string | null) {
  return code === 1
    ? ["kg", "g", "gr"].includes(unit || "")
    : code === 3
      ? ["l", "ml"].includes(unit || "")
      : code === 4
        ? unit === "pz"
        : false;
}
export function rchConsumption(report: RchImport) {
  const mapping = new Map(report.mappings.map((m) => [m.rch_id, m]));
  return report.rows.flatMap((r) => {
    const m = mapping.get(r.rch_id);
    return r.quantity < 0 && m?.ingredient_id && !m.excluded
      ? [
          {
            id: m.ingredient_id,
            name: r.name,
            unit: r.unit_code === 1 ? "kg" : r.unit_code === 3 ? "l" : "pz",
            quantity: -r.quantity / (r.unit_code === 4 ? 1 : 1000),
          },
        ]
      : [];
  });
}
