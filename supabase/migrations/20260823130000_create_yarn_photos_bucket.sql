-- Yarn photo storage: private bucket + per-user RLS on storage.objects (S-01 / add-and-browse-yarn-library)
-- Object path convention: {user_id}/{yarn_id}-{sanitized_filename} — the first path segment must equal
-- auth.uid() for the policies below to grant access.

insert into storage.buckets (id, name, public)
values ('yarn-photos', 'yarn-photos', false);

create policy "yarn_photos_select_own"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'yarn-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "yarn_photos_insert_own"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'yarn-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "yarn_photos_update_own"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'yarn-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "yarn_photos_delete_own"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'yarn-photos' and (storage.foldername(name))[1] = auth.uid()::text);
