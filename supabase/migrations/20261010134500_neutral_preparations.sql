alter table public.recipes drop constraint recipes_preparation_yield_check;
alter table public.recipes add constraint recipes_preparation_yield_check check (recipe_collection <> 'preparations' or (yield_grams is not null and yield_grams > 0 and category is not null and category in ('Entrée','Antipasti','Primi','Secondi','Contorni','Dessert','Basi neutre')));
