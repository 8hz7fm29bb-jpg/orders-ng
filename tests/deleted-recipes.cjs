const assert=require('node:assert/strict')
const fs=require('node:fs'),ts=require('typescript')
process.env.NEXT_PUBLIC_SUPABASE_URL='https://example.test'
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY='test'
let rows=[],deleted=false
const client={from(table){let op='select';return {select(){return this},eq(){return this},neq(){return this},in(){return this},order(){return this},limit(){return this},delete(){op='delete';deleted=true;return this},insert(value){op='insert';rows=value;return this},single(){return Promise.resolve({data:{id:'event'},error:null})},maybeSingle(){return Promise.resolve({data:{id:'menu'},error:null})},then(resolve){let data=[];if(table==='recipes')data=[{id:'live',name:'Piatto attuale',category:'Primi',active:true,standard_portions:1,manual_sale_price:5}];if(table==='event_menu_items'&&op==='select')data=[{recipe_id:null,display_name:'Piatto eliminato',course_type:'Secondi',portions:7,sale_price:12.5}];return Promise.resolve({data,error:null}).then(resolve)}}}}
const moduleResult={exports:{}}
new Function('exports','module','require',ts.transpileModule(fs.readFileSync('lib/supabase.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(moduleResult.exports,moduleResult,name=>name==='@supabase/supabase-js'?{createClient:()=>client}:name==='./preparations'?{composedCost:()=>0}:require(name))
;(async()=>{
 const {loadEventMenuByNumber,saveEventMenuByNumber}=moduleResult.exports
 const loaded=await loadEventMenuByNumber(1)
 assert.equal(loaded.error,null)
 assert.deepEqual(loaded.lines,[{recipe_id:'',display_name:'Piatto eliminato',course_type:'Secondi',portions:7,sale_price:12.5}])
 const result=await saveEventMenuByNumber(1,'menu',[...loaded.lines,{recipe_id:'live',course_type:'Primi',portions:3}],loaded.recipes)
 assert.equal(result.error,null)
 assert.equal(rows[0].recipe_id,null);assert.equal(rows[0].display_name,'Piatto eliminato');assert.equal(rows[0].sale_price,12.5);assert.equal(rows[0].portions,7);assert.equal(rows[0].course_type,'Secondi')
 assert.equal(rows[1].recipe_id,'live');assert.equal(rows[1].display_name,'Piatto attuale')
 deleted=false
 assert.ok((await saveEventMenuByNumber(1,'menu',[{recipe_id:'',course_type:'other'}],[])).error)
 assert.equal(deleted,false)
 assert.ok((await saveEventMenuByNumber(1,'menu',[{recipe_id:'missing',course_type:'Primi'}],[])).error)
 assert.equal(deleted,false)
 console.log('Deleted recipes: menu loads, detached names survive edits, mixed menus save, invalid rows cannot erase menu.')
})().catch(e=>{console.error(e);process.exitCode=1})
