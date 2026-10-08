alter table public.recipes add column recipe_collection text not null default 'banquets' check (recipe_collection in ('banquets','a_la_carte'));
