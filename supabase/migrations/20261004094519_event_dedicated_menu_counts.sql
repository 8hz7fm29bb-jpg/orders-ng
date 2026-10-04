alter table public.events
  add column if not exists celiac_count integer not null default 0 check (celiac_count >= 0),
  add column if not exists vegan_count integer not null default 0 check (vegan_count >= 0),
  add column if not exists vegetarian_count integer not null default 0 check (vegetarian_count >= 0),
  add column if not exists lactose_free_count integer not null default 0 check (lactose_free_count >= 0);

notify pgrst, 'reload schema';
