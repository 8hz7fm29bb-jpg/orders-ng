create or replace function orders_private.can(section text, writing boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (orders_private.is_owner() or exists(select 1 from public.orders_accounts a where a.user_id=auth.uid() and a.active and case when section='recipes' then not writing when writing then a.permissions->>section='write' else a.permissions->>section in ('read','write') end));
$$;
update public.orders_accounts set permissions=jsonb_set(permissions,'{recipes}','"read"') where user_id not in (select id from auth.users where lower(email)='lazzarinimatteo@icloud.com');
alter policy orders_write on public.carte_mappings using ((select orders_private.is_owner())) with check ((select orders_private.is_owner()));
alter policy orders_write on public.carte_sources using ((select orders_private.is_owner())) with check ((select orders_private.is_owner()));