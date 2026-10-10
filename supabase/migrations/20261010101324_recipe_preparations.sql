alter table public.recipes drop constraint recipes_recipe_collection_check;
alter table public.recipes add constraint recipes_recipe_collection_check check (recipe_collection in ('banquets','a_la_carte','preparations'));
alter table public.recipes add column yield_grams numeric;
alter table public.recipes add column yield_estimated boolean not null default false;
alter table public.recipes add constraint recipes_preparation_yield_check check (recipe_collection <> 'preparations' or (yield_grams is not null and yield_grams > 0 and category in ('Primi','Dessert')));
create table public.recipe_preparations (
 id uuid primary key default gen_random_uuid(),
 recipe_id uuid not null references public.recipes(id) on delete cascade,
 preparation_id uuid not null references public.recipes(id) on delete restrict,
 quantity_grams numeric not null check(quantity_grams>0),
 sort_order integer not null default 0,
 unique(recipe_id,preparation_id), check(recipe_id<>preparation_id)
);
create index recipe_preparations_preparation_idx on public.recipe_preparations(preparation_id);
alter table public.recipe_preparations enable row level security;
revoke all on public.recipe_preparations from anon,authenticated;
grant select,insert,update,delete on public.recipe_preparations to authenticated;
create policy "authenticated read preparations" on public.recipe_preparations for select to authenticated using ((select auth.uid()) is not null);
create policy "management write preparations" on public.recipe_preparations for all to authenticated
 using ((select auth.uid()) is not null and coalesce(auth.jwt()->>'email','') not in ('','cucina@officinaventidue.it'))
 with check ((select auth.uid()) is not null and coalesce(auth.jwt()->>'email','') not in ('','cucina@officinaventidue.it'));
create function public.validate_preparation_link() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.recipes where id=new.preparation_id and recipe_collection='preparations' and yield_grams>0) then raise exception 'Seleziona una ricetta Salse e creme con resa valida.'; end if;
 if not exists(select 1 from public.recipes where id=new.recipe_id and recipe_collection in ('banquets','a_la_carte') and category in ('Primi','Dessert')) then raise exception 'Salse e creme sono disponibili solo per Primi e Dessert.'; end if;
 return new;
end $$;
create trigger validate_preparation_link before insert or update on public.recipe_preparations for each row execute function public.validate_preparation_link();
create function public.validate_recipe_preparation_category() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if exists(select 1 from public.recipe_preparations where recipe_id=new.id) and (new.recipe_collection not in ('banquets','a_la_carte') or new.category not in ('Primi','Dessert')) then raise exception 'Rimuovi i collegamenti alle preparazioni prima di cambiare categoria.'; end if;
 if exists(select 1 from public.recipe_preparations where preparation_id=new.id) and new.recipe_collection<>'preparations' then raise exception 'Questa preparazione è utilizzata da altri piatti.'; end if;
 return new;
end $$;
create trigger validate_recipe_preparation_category before update on public.recipes for each row execute function public.validate_recipe_preparation_category();
-- Save metadata and both compositions atomically; respect the caller's RLS.
create function public.save_recipe_with_composition(p_recipe_id uuid,p_recipe jsonb,p_ingredients jsonb,p_preparations jsonb) returns uuid
 language plpgsql security invoker set search_path='' as $$
declare v_id uuid:=p_recipe_id; v_collection text:=p_recipe->>'recipe_collection';
begin
 if auth.uid() is null or coalesce(auth.jwt()->>'email','') in ('','cucina@officinaventidue.it') then raise exception 'Operazione non consentita.'; end if;
 if jsonb_typeof(p_ingredients)<>'array' or jsonb_typeof(p_preparations)<>'array' then raise exception 'Composizione non valida.'; end if;
 if v_collection='preparations' and jsonb_array_length(p_ingredients)=0 then raise exception 'Inserisci gli ingredienti della preparazione.'; end if;
 if exists(select 1 from jsonb_array_elements(p_ingredients) l where (l->>'quantity')::numeric<=0 or l->>'ingredient_id' is null or l->>'unit_id' is null) then raise exception 'Completa gli ingredienti.'; end if;
 if v_id is null then
  insert into public.recipes(name,category,recipe_collection,standard_portions,target_food_cost_percent,manual_sale_price,procedure,notes,yield_grams,yield_estimated)
  values(p_recipe->>'name',p_recipe->>'category',v_collection,(p_recipe->>'standard_portions')::numeric,(p_recipe->>'target_food_cost_percent')::numeric,(p_recipe->>'manual_sale_price')::numeric,p_recipe->>'procedure',p_recipe->>'notes',(p_recipe->>'yield_grams')::numeric,coalesce((p_recipe->>'yield_estimated')::boolean,false)) returning id into v_id;
 else
  perform 1 from public.recipes where id=v_id for update;
  if not found then raise exception 'Ricetta non disponibile.'; end if;
  -- Remove links inside this transaction before a category change.
  delete from public.recipe_preparations where recipe_id=v_id;
  update public.recipes set name=p_recipe->>'name',category=p_recipe->>'category',recipe_collection=v_collection,standard_portions=(p_recipe->>'standard_portions')::numeric,target_food_cost_percent=(p_recipe->>'target_food_cost_percent')::numeric,manual_sale_price=(p_recipe->>'manual_sale_price')::numeric,procedure=p_recipe->>'procedure',notes=p_recipe->>'notes',yield_grams=(p_recipe->>'yield_grams')::numeric,yield_estimated=coalesce((p_recipe->>'yield_estimated')::boolean,false),updated_at=now() where id=v_id;
  if not found then raise exception 'Operazione non consentita.'; end if;
 end if;
 delete from public.recipe_ingredients where recipe_id=v_id;
 insert into public.recipe_ingredients(recipe_id,ingredient_id,quantity,unit_id,sort_order)
 select v_id,(l->>'ingredient_id')::uuid,(l->>'quantity')::numeric,(l->>'unit_id')::uuid,coalesce((l->>'sort_order')::integer,0) from jsonb_array_elements(p_ingredients) l;
 insert into public.recipe_preparations(recipe_id,preparation_id,quantity_grams,sort_order)
 select v_id,(l->>'preparation_id')::uuid,(l->>'quantity_grams')::numeric,coalesce((l->>'sort_order')::integer,0) from jsonb_array_elements(p_preparations) l;
 return v_id;
end $$;
revoke all on function public.save_recipe_with_composition(uuid,jsonb,jsonb,jsonb) from public,anon;
grant execute on function public.save_recipe_with_composition(uuid,jsonb,jsonb,jsonb) to authenticated;
revoke all on function public.validate_preparation_link(),public.validate_recipe_preparation_category() from public,anon;
