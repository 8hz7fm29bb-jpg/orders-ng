alter table public.rch_mappings
  add column grams_per_piece double precision check (grams_per_piece > 0 and grams_per_piece < 'Infinity'::double precision),
  add column target_unit text check (target_unit in ('g','gr','kg','pz'));
