alter table public.recipes drop constraint recipes_preparation_yield_check;
alter table public.recipes add constraint recipes_preparation_yield_check check (recipe_collection <> 'preparations' or (yield_grams is not null and yield_grams > 0 and category is not null and category in ('Entrée','Antipasti','Primi','Secondi','Contorni','Dessert')));
create or replace function public.validate_preparation_link() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.recipes where id=new.preparation_id and recipe_collection='preparations' and yield_grams>0) then raise exception 'Seleziona una preparazione di base con resa valida.'; end if;
 if not exists(select 1 from public.recipes where id=new.recipe_id and recipe_collection in ('banquets','a_la_carte')) then raise exception 'Le preparazioni di base possono essere collegate alle ricette Banchetti e À la carte.'; end if;
 return new;
end $$;
create or replace function public.validate_recipe_preparation_category() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if exists(select 1 from public.recipe_preparations where recipe_id=new.id) and new.recipe_collection not in ('banquets','a_la_carte') then raise exception 'Rimuovi i collegamenti prima di trasformare il piatto in una preparazione di base.'; end if;
 if exists(select 1 from public.recipe_preparations where preparation_id=new.id) and new.recipe_collection<>'preparations' then raise exception 'Questa preparazione è utilizzata da altri piatti.'; end if;
 return new;
end $$;
