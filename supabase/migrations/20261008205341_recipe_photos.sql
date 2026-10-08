alter table public.recipes add column photo_path text;
alter table public.recipes add constraint recipe_photo_path_matches_recipe check (photo_path is null or photo_path like id::text || '/%');
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values ('recipe-photos','recipe-photos',false,5242880,array['image/jpeg']);
create policy recipe_photos_read on storage.objects for select to authenticated
using (bucket_id='recipe-photos' and exists(select 1 from public.recipes r where r.id::text=split_part(name,'/',1)));
create policy recipe_photos_insert on storage.objects for insert to authenticated
with check (bucket_id='recipe-photos' and (select auth.uid()) is not null and coalesce(auth.jwt()->>'email','')<>'' and auth.jwt()->>'email'<>'cucina@officinaventidue.it' and exists(select 1 from public.recipes r where r.id::text=split_part(name,'/',1)));
create policy recipe_photos_delete on storage.objects for delete to authenticated
using (bucket_id='recipe-photos' and (select auth.uid()) is not null and coalesce(auth.jwt()->>'email','')<>'' and auth.jwt()->>'email'<>'cucina@officinaventidue.it' and exists(select 1 from public.recipes r where r.id::text=split_part(name,'/',1)));
