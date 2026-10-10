-- Initial bases use only the ingredients already registered in the source dish.
-- The initial yield is their summed mass (not a measured kitchen yield).
-- A strict match prevents combining variants with different compositions.
alter table public.recipes drop constraint recipes_preparation_yield_check;
alter table public.recipes add constraint recipes_preparation_yield_check check (recipe_collection <> 'preparations' or (yield_grams is not null and yield_grams > 0 and category is not null and category in ('Primi','Dessert')));
create or replace function public.validate_recipe_preparation_category() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if exists(select 1 from public.recipe_preparations where recipe_id=new.id) and (new.recipe_collection not in ('banquets','a_la_carte') or new.category is null or new.category not in ('Primi','Dessert')) then raise exception 'Rimuovi i collegamenti alle preparazioni prima di cambiare categoria.'; end if;
 if exists(select 1 from public.recipe_preparations where preparation_id=new.id) and new.recipe_collection<>'preparations' then raise exception 'Questa preparazione è utilizzata da altri piatti.'; end if;
 return new;
end $$;

do $$
declare spec jsonb; source_id uuid; prep_id uuid; source_lines jsonb; source_signature jsonb; candidate_signature jsonb; base_mass numeric; candidate record; moved integer:=0; expected integer;
begin
 create temporary table preparation_before on commit drop as select recipe_id,ingredient_id,unit_id,sum(quantity) quantity from public.recipe_ingredients group by recipe_id,ingredient_id,unit_id;
 for spec in select value from jsonb_array_elements('[
 {"name":"Chantilly","category":"Dessert","source":"Millefoglie farcita con Chantilly e frutti di bosco","pattern":"%chantilly%","ingredients":["Panna 38%","Tuorlo uova","Maizena","Essenza Limone","Essenza Vaniglia"]},
 {"name":"Crema tiramisù","category":"Dessert","source":"Mini tiramisù","pattern":"Mini tiramisù","ingredients":["Panna 38%","Mascarpone","Misto uova pastorizzate"]},
 {"name":"Crema catalana","category":"Dessert","source":"Mini catalana","pattern":"Mini catalana","ingredients":["Panna 38%","Catalana Carte d''Or in polvere","Latte"]},
 {"name":"Coulis di basilico","category":"Primi","source":"Ravioli datterino rosso salsiccia coulisse di basilico e straccia","pattern":"%coulisse di basilico%","ingredients":["Basilico","Olio extravergine di oliva"]},
 {"name":"Vellutata di porri","category":"Primi","source":"Gnocchi viola su vellutata di porri, tartufo e guanciale","pattern":"%vellutata di porri%","ingredients":["Porri","Burro"]}
 ]'::jsonb) loop
  select id into source_id from public.recipes where name=spec->>'source' and recipe_collection='banquets' and standard_portions=1;
  if source_id is null then raise exception 'Ricetta sorgente non trovata: %', spec->>'source'; end if;
  select jsonb_agg(jsonb_build_object('ingredient_id',ri.ingredient_id,'unit_id',ri.unit_id,'quantity',ri.quantity,'sort_order',ri.sort_order) order by ri.ingredient_id),sum(ri.quantity),count(*) into source_lines,base_mass,expected
  from public.recipe_ingredients ri join public.ingredients i on i.id=ri.ingredient_id join public.units u on u.id=ri.unit_id
  where ri.recipe_id=source_id and trim(i.name) in (select jsonb_array_elements_text(spec->'ingredients')) and u.code='g';
  if expected<>jsonb_array_length(spec->'ingredients') or base_mass<=0 then raise exception 'Composizione sorgente incompleta: %',spec->>'name'; end if;
  select jsonb_agg(jsonb_build_object('ingredient_id',x->>'ingredient_id','unit_id',x->>'unit_id','quantity',(x->>'quantity')::numeric) order by x->>'ingredient_id') into source_signature from jsonb_array_elements(source_lines) x;
  insert into public.recipes(name,category,recipe_collection,standard_portions,yield_grams,yield_estimated,notes)
  values(spec->>'name',spec->>'category','preparations',1,1000,true,'Base iniziale ricavata dagli ingredienti già registrati in «'||(spec->>'source')||'». Composizione e resa teorica (somma dei pesi, senza cali) da verificare in cucina. Confermare anche la quota di olio o burro attribuita alla base.') returning id into prep_id;
  insert into public.recipe_ingredients(recipe_id,ingredient_id,unit_id,quantity,sort_order)
  select prep_id,(x->>'ingredient_id')::uuid,(x->>'unit_id')::uuid,(x->>'quantity')::numeric*1000/base_mass,(x->>'sort_order')::integer from jsonb_array_elements(source_lines) x;
  for candidate in select id from public.recipes where recipe_collection='banquets' and category=spec->>'category' and name ilike spec->>'pattern' and standard_portions=1 loop
   select jsonb_agg(jsonb_build_object('ingredient_id',ri.ingredient_id::text,'unit_id',ri.unit_id::text,'quantity',ri.quantity) order by ri.ingredient_id::text) into candidate_signature
   from public.recipe_ingredients ri where ri.recipe_id=candidate.id and ri.ingredient_id in (select (x->>'ingredient_id')::uuid from jsonb_array_elements(source_lines) x);
   if candidate_signature=source_signature then
    insert into public.recipe_preparations(recipe_id,preparation_id,quantity_grams) values(candidate.id,prep_id,base_mass);
    delete from public.recipe_ingredients where recipe_id=candidate.id and ingredient_id in (select (x->>'ingredient_id')::uuid from jsonb_array_elements(source_lines) x);
    moved:=moved+1;
   end if;
  end loop;
 end loop;
 -- Input quantities for every existing dish must remain identical after expansion.
 if exists(
  with expanded as (
   select recipe_id,ingredient_id,unit_id,quantity from public.recipe_ingredients
   union all
   select rp.recipe_id,ri.ingredient_id,ri.unit_id,ri.quantity*rp.quantity_grams/p.yield_grams from public.recipe_preparations rp join public.recipes p on p.id=rp.preparation_id join public.recipe_ingredients ri on ri.recipe_id=p.id
  ),after_totals as (select e.recipe_id,e.ingredient_id,e.unit_id,sum(e.quantity) quantity from expanded e join public.recipes r on r.id=e.recipe_id where r.recipe_collection<>'preparations' group by e.recipe_id,e.ingredient_id,e.unit_id)
  select 1 from preparation_before b full join after_totals a using(recipe_id,ingredient_id,unit_id) where abs(coalesce(b.quantity,0)-coalesce(a.quantity,0))>0.0000001
 ) then raise exception 'Il trasferimento altererebbe le quantità originali: operazione annullata.'; end if;
 if moved<5 then raise exception 'Numero insufficiente di collegamenti iniziali: %',moved; end if;
end $$;
