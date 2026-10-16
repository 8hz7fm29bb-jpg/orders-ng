import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
const headers = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Content-Type':'application/json'}
Deno.serve(async (req) => {
 if(req.method==='OPTIONS') return new Response('ok',{headers})
 const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers})
 try {
  const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}})
  const token=req.headers.get('Authorization')?.replace(/^Bearer\s+/i,'')||''
  const {data:{user},error}=await admin.auth.getUser(token)
  if(error||!user||user.email?.toLowerCase()!=='lazzarinimatteo@icloud.com') return reply({error:'Accesso riservato all’account principale.'},403)
  if(req.method!=='POST') return reply({error:'Metodo non consentito'},405)
  const body=await req.json();const email=String(body.email||'').trim().toLowerCase()
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email===user.email?.toLowerCase()) return reply({error:'Indirizzo email non valido.'},400)
  const permissions=body.permissions||{}
  const keys=['dashboard','events','clients','recipes','ingredients','rch','associations','reports']
  if(Object.entries(permissions).some(([k,v])=>!keys.includes(k)||!['read','write'].includes(String(v))))return reply({error:'Permessi non validi'},400)
  // Match existing shared Auth identities without changing credentials used by TRACE.
  let target=null
  for(let page=1;;page++){const r=await admin.auth.admin.listUsers({page,perPage:1000});if(r.error)throw r.error;target=r.data.users.find(u=>u.email?.toLowerCase()===email);if(target||r.data.users.length<1000)break}
  if(!target){if(String(body.password||'').length<10)return reply({error:'Per un nuovo account inserisci una password di almeno 10 caratteri.'},400);const r=await admin.auth.admin.createUser({email,password:body.password,email_confirm:true});if(r.error)throw r.error;target=r.data.user}
  if(!target)throw new Error('Account non disponibile')
  const r=await admin.from('orders_accounts').upsert({user_id:target.id,email,active:true,permissions});if(r.error)throw r.error
  return reply({ok:true})
 } catch(e){return reply({error:e instanceof Error?e.message:'Operazione non riuscita'},400)}
})
