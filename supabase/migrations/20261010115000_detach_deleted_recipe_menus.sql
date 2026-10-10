-- Keep the menu label when a recipe is permanently deleted.
-- The existing menu portions, order and agreed price belong to the event.
create function public.preserve_deleted_recipe_menu_name() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
 update public.event_menu_items
 set display_name = old.name, recipe_id = null
 where recipe_id = old.id;
 return old;
end;
$$;
create trigger preserve_deleted_recipe_menu_name
before delete on public.recipes
for each row execute function public.preserve_deleted_recipe_menu_name();
