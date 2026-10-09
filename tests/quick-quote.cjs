const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const moduleResult = { exports: {} }
const compiled = ts.transpileModule(fs.readFileSync('lib/quick-quote.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
new Function('exports', 'module', 'require', compiled)(moduleResult.exports, moduleResult, require)
const { scaleMenu, menuBase, quotePrice } = moduleResult.exports
const original = [
  { recipe_id: 'starter', sale_price: 10, portion_ratio: .8, portions: 80 },
  { recipe_id: 'main', sale_price: 20, portion_ratio: 1, portions: 100 },
  { recipe_id: 'dessert', sale_price: 5, portion_ratio: .5, portions: 50 }
]
assert.deepEqual(scaleMenu(original, 50).map(l => l.portions), [40, 50, 25])
assert.deepEqual(scaleMenu(scaleMenu(original, 0), 50).map(l => l.portions), [40, 50, 25])
assert.deepEqual(original.map(l => l.portions), [80, 100, 50])
assert.equal(quotePrice(scaleMenu(original, 50), original, 50), 50)
assert.equal(quotePrice(original.filter(l => l.recipe_id !== 'main'), original, 50), 30)
assert.equal(quotePrice([...original, { recipe_id: 'extra', sale_price: 4, portion_ratio: 1 }], original, 50), 54)
assert.equal(menuBase([{ sale_price: 5.01, portion_ratio: 1 }]), 5.5)
assert.equal(quotePrice([{ sale_price: 0, portion_ratio: 1 }], original, 10), 0)
console.log('Quick quote: proportional portions, stable prices, edits and rounding passed.')
