create table public.quick_quote_templates (
  id text primary key check (id = 'default'),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  updated_at timestamptz not null default now()
);
alter table public.quick_quote_templates enable row level security;
revoke all on public.quick_quote_templates from public, anon;
grant select, insert, update on public.quick_quote_templates to authenticated;
create policy "management quick quote templates" on public.quick_quote_templates
  for all to authenticated
  using (coalesce(auth.jwt()->>'email','') <> 'cucina@officinaventidue.it')
  with check (coalesce(auth.jwt()->>'email','') <> 'cucina@officinaventidue.it');

alter table public.events add column quick_quote_key uuid unique;

-- The authenticated caller's existing RLS permissions remain in force.
-- A transaction saves client, event and both menus together; repeated requests
-- update the same draft rather than creating a duplicate event.
create function public.save_quick_quote(p_request_id uuid, p_quote jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_event public.events%rowtype;
  v_client public.clients%rowtype;
  v_client_id uuid;
  v_name text := trim(p_quote->>'client_name');
  v_menu_id uuid;
  v_audience text;
  v_lines jsonb;
  v_adults integer := (p_quote->>'adults')::integer;
  v_baby integer := (p_quote->>'baby')::integer;
  v_adult_price numeric := (p_quote->>'price_per_adult')::numeric;
  v_baby_price numeric := (p_quote->>'price_per_baby')::numeric;
begin
  if auth.uid() is null or coalesce(auth.jwt()->>'email','') = 'cucina@officinaventidue.it' then
    raise exception 'Operazione riservata alla gestione.' using errcode = '42501';
  end if;
  if p_request_id is null or nullif(trim(p_quote->>'event_date'),'') is null
    or (p_quote->>'service') is null or (p_quote->>'service') not in ('pranzo','cena','altro')
    or v_adults is null or v_adults < 1 or v_baby is null or v_baby < 0
    or v_adult_price is null or v_adult_price < 0 or v_adult_price::text in ('NaN','Infinity','-Infinity')
    or v_baby_price is null or v_baby_price < 0 or v_baby_price::text in ('NaN','Infinity','-Infinity') then
    raise exception 'Completa data, servizio, ospiti e prezzi.';
  end if;
  if jsonb_typeof(p_quote->'adult_lines') is distinct from 'array'
    or jsonb_typeof(p_quote->'baby_lines') is distinct from 'array' then
    raise exception 'Menu non valido.';
  end if;
  if jsonb_array_length(p_quote->'adult_lines') = 0
    or (v_baby > 0 and jsonb_array_length(p_quote->'baby_lines') = 0) then
    raise exception 'Inserisci le portate del menu.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 0));
  select * into v_event from public.events where quick_quote_key = p_request_id for update;
  if v_event.id is not null and v_event.status <> 'bozza' then
    raise exception 'Questo evento è già stato gestito: aprilo dalla sezione Eventi.';
  end if;
  v_client_id := nullif(p_quote->>'client_id','')::uuid;
  if v_client_id is null and v_event.id is not null then
    select id into v_client_id from public.clients where id=v_event.client_id
      and lower(trim(coalesce(company_name,nullif(trim(concat_ws(' ',first_name,last_name)),''))))=lower(v_name);
  end if;
  if v_client_id is null then
    if coalesce(v_name,'') = '' then raise exception 'Inserisci il nome del cliente.'; end if;
    insert into public.clients(customer_type,first_name,last_name,phone)
    values ('privato',split_part(v_name,' ',1),nullif(trim(substr(v_name,length(split_part(v_name,' ',1))+1)),''),nullif(trim(p_quote->>'phone'),''))
    returning id into v_client_id;
  end if;
  select * into strict v_client from public.clients where id = v_client_id;
  if v_event.id is null then
    insert into public.events(client_id,event_date,service,adults,baby,status,price_per_adult,price_per_baby,price_adjustment,baby_price_adjustment,quick_quote_key)
    values (v_client_id,(p_quote->>'event_date')::date,p_quote->>'service',v_adults,v_baby,'bozza',v_adult_price,v_baby_price,
      coalesce((p_quote->>'price_adjustment')::numeric,0),coalesce((p_quote->>'baby_price_adjustment')::numeric,0),p_request_id)
    returning * into v_event;
  else
    update public.events set client_id=v_client_id,event_date=(p_quote->>'event_date')::date,service=p_quote->>'service',adults=v_adults,baby=v_baby,
      price_per_adult=v_adult_price,price_per_baby=v_baby_price,price_adjustment=coalesce((p_quote->>'price_adjustment')::numeric,0),
      baby_price_adjustment=coalesce((p_quote->>'baby_price_adjustment')::numeric,0)
    where id=v_event.id returning * into v_event;
  end if;
  foreach v_audience in array array['adult','baby'] loop
    v_lines := p_quote->(v_audience||'_lines');
    if exists (
      select 1 from jsonb_array_elements(v_lines) l
      left join public.recipes r on r.id=nullif(l->>'recipe_id','')::uuid
      where r.id is null or r.recipe_collection <> 'banquets' or not r.active
        or (l->>'portions') is null or (l->>'portions')::numeric < 0 or (l->>'portions')::numeric::text in ('NaN','Infinity','-Infinity')
        or (l->>'sale_price') is null or (l->>'sale_price')::numeric < 0 or (l->>'sale_price')::numeric::text in ('NaN','Infinity','-Infinity')
    ) then raise exception 'Le portate devono usare ricette Banchetti attive e quantità valide.'; end if;
    select id into v_menu_id from public.event_menus
      where event_id=v_event.id and name=case when v_audience='baby' then 'Menu baby' else 'Menu principale' end and active limit 1;
    if v_menu_id is null then
      insert into public.event_menus(event_id,name,active)
      values (v_event.id,case when v_audience='baby' then 'Menu baby' else 'Menu principale' end,true) returning id into v_menu_id;
    end if;
    delete from public.event_menu_items where menu_id=v_menu_id;
    insert into public.event_menu_items(menu_id,recipe_id,course_type,display_name,portions,sale_price,sort_order,customer_visible)
    select v_menu_id,r.id,coalesce(r.category,'other'),r.name,(l.value->>'portions')::numeric,(l.value->>'sale_price')::numeric,l.ordinality-1,true
    from jsonb_array_elements(v_lines) with ordinality l(value,ordinality)
    join public.recipes r on r.id=(l.value->>'recipe_id')::uuid;
  end loop;
  return jsonb_build_object('id',v_event.id,'event_number',v_event.event_number,'client',to_jsonb(v_client));
end;
$$;
revoke all on function public.save_quick_quote(uuid,jsonb) from public,anon;
grant execute on function public.save_quick_quote(uuid,jsonb) to authenticated;
notify pgrst,'reload schema';
