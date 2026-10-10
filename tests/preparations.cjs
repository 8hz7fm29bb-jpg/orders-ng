const assert = require('node:assert/strict')
const fs = require('node:fs'), ts = require('typescript'), result = { exports: {} }
const code=ts.transpileModule(fs.readFileSync('lib/preparations.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText
new Function('exports','module','require',code)(result.exports,result,require)
const {composedCost,expandedIngredients,preparationNeeds}=result.exports
const line=(id,qty,price,unit='g',priceUnit='kg')=>({ingredient_id:id,unit_id:unit,quantity:qty,unit:{code:unit},ingredient:{id,name:id,current_price:price,unit:{code:priceUnit}}})
const cream={id:'cream',name:'Chantilly',category:'Dessert',yield_grams:1000,recipe_ingredients:[line('cream',640,10),line('yolk',200,8),line('starch',80,4),line('lemon',40,6),line('vanilla',40,7)]}
const recipe={standard_portions:1,recipe_ingredients:[line('berries',10,12)],recipe_preparations:[{preparation_id:'cream',quantity_grams:25,preparation:cream}]}
const old={standard_portions:1,recipe_ingredients:[line('berries',10,12),...cream.recipe_ingredients.map(l=>({...l,quantity:l.quantity/40}))]}
assert.ok(Math.abs(composedCost(recipe)-composedCost(old))<1e-10,'Food cost preserved when extracting a cream')
const expanded=expandedIngredients(recipe)
assert.deepEqual(expanded.map(l=>l.quantity),[10,16,5,2,1,1])
const recipeMap=new Map([['fruit',recipe],['chocolate',{...recipe,recipe_ingredients:[line('chocolate',15,10)]}]])
const needs=preparationNeeds([{id:'fruit',name:'Fruit millefoglie',quantity:257},{id:'chocolate',name:'Chocolate millefoglie',quantity:40}],recipeMap)
assert.equal(needs.length,1);assert.equal(needs[0].quantity_grams,7425);assert.equal(needs[0].uses.length,2)
assert.equal(preparationNeeds([{id:'fruit',name:'Fruit',quantity:0}],recipeMap).length,0)
assert.equal(preparationNeeds([{id:'missing',name:'No recipe',quantity:20}],recipeMap).length,0)
const multi={...recipe,standard_portions:10,recipe_preparations:[{preparation_id:'cream',quantity_grams:250,preparation:cream}]}
assert.equal(preparationNeeds([{id:'fruit',name:'Fruit',quantity:20}],new Map([['fruit',multi]]))[0].quantity_grams,500)
const changed={...recipe,recipe_preparations:[{...recipe.recipe_preparations[0],preparation:{...cream,yield_grams:800}}]}
assert.ok(composedCost(changed)>composedCost(recipe),'Changing the yield updates linked cost')
assert.equal(expandedIngredients(changed)[1].quantity,20)
assert.equal(composedCost({standard_portions:1,recipe_ingredients:[line('oil',20,10,'ml','l')]}),.2)
console.log('Preparations: shared totals, preserved food cost, expanded ingredients, batch portions, changed yield and unit conversion passed.')
