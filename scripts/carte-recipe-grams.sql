-- Keep recipe quantities in grams even when inventory prices use kilograms.
begin;
select pg_advisory_xact_lock(221008);
update public.recipe_ingredients ri
set quantity=ri.quantity*1000,unit_id=(select id from public.units where code='g')
from public.recipes r,public.units u
where r.id=ri.recipe_id and r.recipe_collection='a_la_carte'
and u.id=ri.unit_id and u.code='kg';
update public.carte_mappings m
set factor=m.factor*1000,unit_id=(select id from public.units where code='g')
from public.units u where u.id=m.unit_id and u.code='kg';
CREATE OR REPLACE FUNCTION public.associate_carte(p_key text, p_ingredient uuid, p_weight numeric DEFAULT NULL::numeric)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare m carte_mappings%rowtype; target_unit uuid; target_code text; f numeric; x record; old_line recipe_ingredients%rowtype; affected uuid[]; n integer; pending text;
begin
 if auth.uid() is null or coalesce(auth.jwt()->>'email','')='' or auth.jwt()->>'email'='cucina@officinaventidue.it' then raise exception 'Accesso non consentito'; end if;
 -- Serialize associations before locking recipe rows, including different source names in the same recipe.
 perform pg_advisory_xact_lock(221008);
 select * into strict m from carte_mappings where source_key=p_key for update;
 if p_ingredient is not null then
  select i.unit_id,u.code into target_unit,target_code from ingredients i join units u on u.id=i.unit_id where i.id=p_ingredient and i.active;
  if target_unit is null then raise exception 'Ingrediente non disponibile'; end if;
  if m.source_unit=target_code then f:=1;
  elsif m.source_unit='g' and target_code='kg' or m.source_unit='ml' and target_code='l' then f:=0.001;
  elsif m.source_unit='kg' and target_code='g' or m.source_unit='l' and target_code='ml' then f:=1000;
  elsif m.source_unit='g' and target_code='pz' and p_weight>0 then f:=1/p_weight;
  elsif m.source_unit='pz' and target_code in ('g','kg') and p_weight>0 then f:=p_weight * case when target_code='kg' then 0.001 else 1 end;
  else raise exception 'Unità incompatibili: indica il peso in grammi per pezzo, oppure scegli un ingrediente con unità compatibile'; end if;
 end if;
 if target_code='kg' then
  select id into strict target_unit from units where code='g';
  f:=f*1000;
 end if;
 select array_agg(distinct s.recipe_id) into affected from carte_sources s join recipes r on r.id=s.recipe_id where s.source_key=p_key and r.recipe_collection='a_la_carte';
 n:=coalesce(array_length(affected,1),0);
 perform 1 from recipes where id=any(affected) order by id for update;
 -- Protect edits made directly in the recipe: never silently overwrite changed quantities.
 for x in select s.recipe_id,cm.ingredient_id,cm.unit_id,sum(s.quantity*cm.factor) qty from carte_sources s join carte_mappings cm using(source_key) where s.recipe_id=any(affected) and cm.ingredient_id is not null group by s.recipe_id,cm.ingredient_id,cm.unit_id loop
  select * into old_line from recipe_ingredients where recipe_id=x.recipe_id and ingredient_id=x.ingredient_id for update;
  if not found or old_line.unit_id<>x.unit_id or abs(old_line.quantity-x.qty)>0.00000001 then raise exception 'Una ricetta è stata modificata manualmente: controlla le quantità prima di cambiare questa associazione'; end if;
 end loop;
 delete from recipe_ingredients ri using carte_sources s,carte_mappings cm where ri.recipe_id=s.recipe_id and s.source_key=cm.source_key and ri.ingredient_id=cm.ingredient_id and s.recipe_id=any(affected);
 update carte_mappings set ingredient_id=p_ingredient,unit_id=target_unit,factor=f where source_key=p_key;
 if exists(select 1 from recipe_ingredients ri join carte_sources s on s.recipe_id=ri.recipe_id join carte_mappings cm on cm.source_key=s.source_key and cm.ingredient_id=ri.ingredient_id where s.recipe_id=any(affected)) then raise exception 'Ingrediente già aggiunto manualmente a una ricetta: controlla il doppione prima di associare'; end if;
 insert into recipe_ingredients(recipe_id,ingredient_id,unit_id,quantity,sort_order,notes)
 select s.recipe_id,cm.ingredient_id,cm.unit_id,sum(s.quantity*cm.factor),min(s.sort_order),string_agg(cm.name||': '||s.quantity||' '||cm.source_unit||coalesce(' ('||s.part||')',''), E'\n' order by s.sort_order)
 from carte_sources s join carte_mappings cm using(source_key) where s.recipe_id=any(affected) and cm.ingredient_id is not null group by s.recipe_id,cm.ingredient_id,cm.unit_id;
 for x in select id,notes from recipes where id=any(affected) loop
  select string_agg(cm.name||': '||s.quantity||' '||cm.source_unit,E'\n' order by s.sort_order) into pending from carte_sources s join carte_mappings cm using(source_key) where s.recipe_id=x.id and cm.ingredient_id is null;
  update recipes set notes=regexp_replace(coalesce(x.notes,''), E'\\n(?:RICETTA INCOMPLETA:[\\s\\S]*?|Tutti gli ingredienti associati\\.)\\nDettaglio originale:', E'\n'||case when pending is null then 'Tutti gli ingredienti associati.' else 'RICETTA INCOMPLETA: costi e fabbisogni parziali. Ingredienti da associare:'||E'\n'||pending end||E'\nDettaglio originale:') where id=x.id;
 end loop;
 return n;
end $function$;
commit;
