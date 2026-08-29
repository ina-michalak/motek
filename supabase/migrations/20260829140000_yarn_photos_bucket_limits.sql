-- Defense-in-depth: enforce the same size/type limits at the Storage bucket
-- level that src/lib/validation/yarn.ts already enforces in the app layer.
update storage.buckets
set file_size_limit = 5242880, -- 5 MB, matches MAX_PHOTO_SIZE_BYTES in src/lib/validation/yarn.ts
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'yarn-photos';
