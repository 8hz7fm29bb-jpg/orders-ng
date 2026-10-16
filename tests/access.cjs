const assert=require('node:assert/strict')
const ts=require('typescript')
const vm=require('node:vm')
const fs=require('node:fs')
const sandbox={exports:{}}
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/access.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,sandbox)
const {canAccess}=sandbox.exports
const kitchen={owner:false,active:true,permissions:{events:'read',recipes:'read',reports:'read'}}
assert.equal(canAccess(null,'events'),false)
assert.equal(canAccess(kitchen,'accounts'),false)
assert.equal(canAccess(kitchen,'recipes'),true)
assert.equal(canAccess(kitchen,'recipes',true),false)
assert.equal(canAccess(kitchen,'ingredients'),false)
assert.equal(canAccess({...kitchen,active:false},'events'),false)
assert.equal(canAccess({...kitchen,owner:true},'accounts'),true)
assert.equal(canAccess({...kitchen,permissions:{associations:'write'}},'carte-associations',true),true)
assert.equal(canAccess({...kitchen,permissions:{associations:'read'}},'rch-associations',true),false)
console.log('Account access checks passed')
