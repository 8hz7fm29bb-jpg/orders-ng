export const ACCESS_SECTIONS = [
 {id:'dashboard',label:'Dashboard'},{id:'events',label:'Eventi'},{id:'clients',label:'Clienti'},
 {id:'recipes',label:'Ricettario'},{id:'ingredients',label:'Ingredienti'},
 {id:'rch',label:'Consumi RCH'},{id:'associations',label:'Associazioni'},{id:'reports',label:'Report'},
] as const
export type Permissions = Partial<Record<typeof ACCESS_SECTIONS[number]['id'],'read'|'write'>>
export type OrdersAccess = {owner:boolean;active:boolean;permissions:Permissions}
export function canAccess(access:OrdersAccess|null,section:string,write=false){
 if(!access?.active)return false
 if(access.owner)return true
 if(section==='accounts')return false
 const key=section.includes('associations')?'associations':section
 const level=access.permissions[key as keyof Permissions]
 return write?level==='write':level==='read'||level==='write'
}
