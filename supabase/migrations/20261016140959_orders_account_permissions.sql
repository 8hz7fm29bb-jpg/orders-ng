create schema if not exists orders_private;
revoke all on schema orders_private from public;
grant usage on schema orders_private to authenticated;
create table public.orders_accounts (
 user_id uuid primary key references auth.users(id) on delete cascade,
 email text not null, active boolean not null default true,
 permissions jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
insert into public.orders_accounts(user_id,email,permissions)
select id,email,case when email='cucina@officinaventidue.it' then '{"events":"read","recipes":"read","reports":"read"}'::jsonb else '{"dashboard":"read","events":"write","clients":"write","recipes":"write","ingredients":"write","rch":"write","associations":"write","reports":"read"}'::jsonb end
from auth.users where email in ('lazzarinimatteo@icloud.com','cucina@officinaventidue.it');
create function orders_private.is_owner() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from auth.users where id=auth.uid() and lower(email)='lazzarinimatteo@icloud.com');
$$;
create function orders_private.can(section text, writing boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (orders_private.is_owner() or exists(select 1 from public.orders_accounts a where a.user_id=auth.uid() and a.active and case when writing then a.permissions->>section='write' else a.permissions->>section in ('read','write') end));
$$;
revoke all on function orders_private.is_owner(), orders_private.can(text,boolean) from public;
grant execute on function orders_private.is_owner(), orders_private.can(text,boolean) to authenticated;
alter table public.orders_accounts enable row level security;
grant select,insert,update,delete on public.orders_accounts to authenticated;
create policy accounts_read on public.orders_accounts for select to authenticated using(user_id=(select auth.uid()) or (select orders_private.is_owner()));
create policy accounts_owner_write on public.orders_accounts for all to authenticated using((select orders_private.is_owner()) and user_id<>(select auth.uid())) with check((select orders_private.is_owner()) and user_id<>(select auth.uid()));
create function public.orders_current_access() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('owner',orders_private.is_owner(),'active',orders_private.is_owner() or coalesce((select active from public.orders_accounts where user_id=auth.uid()),false),'permissions',coalesce((select permissions from public.orders_accounts where user_id=auth.uid()),'{}'::jsonb));
$$;
revoke all on function public.orders_current_access() from public;
grant execute on function public.orders_current_access() to authenticated;
-- Only Orders policies are replaced; TRACE shares Auth but retains its own permissions.
do $$ declare t text; p record; s text; reads text; begin
for t,s in select * from (values ('clients','clients'),('units','ingredients'),('suppliers','ingredients'),('ingredients','ingredients'),('ingredient_prices','ingredients'),('recipes','recipes'),('recipe_ingredients','recipes'),('recipe_preparations','recipes'),('events','events'),('event_status_history','events'),('event_menus','events'),('event_menu_items','events'),('quotes','events'),('quote_versions','events'),('quick_quote_templates','events'),('rch_mappings','associations'),('rch_imports','rch'),('carte_mappings','associations'),('carte_sources','associations')) as m(t,s) loop
 for p in select policyname from pg_policies where schemaname='public' and tablename=t loop execute format('drop policy %I on public.%I',p.policyname,t); end loop;
 reads:=format('orders_private.can(%L)',s);
 if s='events' then reads:=reads||' or orders_private.can(''reports'') or orders_private.can(''dashboard'')'; end if;
 if s='clients' then reads:=reads||' or orders_private.can(''events'') or orders_private.can(''reports'') or orders_private.can(''dashboard'')'; end if;
 if s in ('recipes','ingredients') then reads:=reads||' or orders_private.can(''events'') or orders_private.can(''reports'') or orders_private.can(''recipes'') or orders_private.can(''rch'') or orders_private.can(''associations'')'; end if;
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy orders_read on public.%I for select to authenticated using (%s)',t,reads);
 execute format('create policy orders_write on public.%I for all to authenticated using (orders_private.can(%L,true)) with check (orders_private.can(%L,true))',t,s,s);
end loop;
end $$;
alter policy recipe_photos_insert on storage.objects with check(bucket_id='recipe-photos' and orders_private.can('recipes',true) and exists(select 1 from public.recipes r where r.id::text=split_part(storage.objects.name,'/',1)));
alter policy recipe_photos_delete on storage.objects using(bucket_id='recipe-photos' and orders_private.can('recipes',true) and exists(select 1 from public.recipes r where r.id::text=split_part(storage.objects.name,'/',1)));
