const assert = require("node:assert/strict"),
  fs = require("fs"),
  ts = require("typescript"),
  vm = require("vm"),
  X = require("xlsx");
const source = ts.transpileModule(fs.readFileSync("lib/rch.ts", "utf8"), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;
const context = {
  exports: {},
  require,
  TextEncoder,
  Uint8Array,
  crypto: require("node:crypto").webcrypto,
};
vm.runInNewContext(source, context);
const { parseStock, rchConsumption, compatible } = context.exports;
const raw = process.argv[2]
  ? X.utils.sheet_to_json(X.readFile(process.argv[2]).Sheets.stock, {
      header: 1,
    })
  : [
      ["id", "nome", "unita'", "quantità", "soglia", "prodotto"],
      [231, "Pinsa", 4, -1880, 0, 5],
      [231, "Pinsa", 4, -1880, 0, 6],
      [250, "Mascarpone", 1, -42380, 0, 73],
      [350, "Vini bianchi", 4, -20, 0, 1],
      [351, "Zero", 1, 0, 0, 1],
    ];
const rows = parseStock(raw);
assert.equal(rows.length, process.argv[2] ? 137 : 4);
assert.equal(rows.find((r) => r.name === "Pinsa").quantity, -1880);
assert.throws(
  () => parseStock([raw[0], raw[1], [...raw[1].slice(0, 3), -10, 0, 5]]),
  /discordanti/,
);
assert.throws(
  () => parseStock([raw[0], [1, "Test", 7, -1, 0, 0]]),
  /non valida/,
);
assert.equal(compatible(4, "kg"), false);
assert.equal(compatible(1, "kg"), true);
const mappings = rows.map((r) => ({
  ...r,
  ingredient_id: String(r.rch_id),
  excluded: r.name.startsWith("Vini "),
}));
const consumption = rchConsumption({ rows, mappings });
assert.equal(consumption.find((r) => r.name === "Mascarpone").quantity, 42.38);
assert.equal(consumption.find((r) => r.name === "Pinsa").quantity, 1880);
assert.equal(
  consumption.some((r) => r.name.startsWith("Vini ")),
  false,
);
assert.equal(
  consumption.some((r) => r.quantity <= 0),
  false,
);
const small = parseStock([
  raw[0],
  [1, "A", 1, "-1.250,5", 0, 1],
  [1, "A", 1, "-1.250,5", 0, 2],
  [2, "B", 3, -2500, 0, 1],
  [3, "C", 4, 10, 0, 1],
]);
assert.equal(small.length, 3);
const c = rchConsumption({
  rows: small,
  mappings: small.map((r) => ({
    ...r,
    ingredient_id: "same",
    excluded: false,
  })),
});
assert.equal(c[0].quantity, 1.2505);
assert.equal(c[1].quantity, 2.5);
assert.equal(c.length, 2);
console.log(
  "PASS: real Numbers file, deduplication, conflict rejection, unit validation, conversions, wine exclusions, non-consumption balances.",
);
