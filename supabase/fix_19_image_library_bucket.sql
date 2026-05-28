-- Fix #19: Storage bucket image-library — políticas de lectura
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query
--
-- ANTES de ejecutar este script:
--   1. Ir a Dashboard → Storage → New Bucket
--   2. Nombre: image-library
--   3. Public bucket: SÍ
--   4. File size limit: 10485760 (10 MB)
--   5. Allowed MIME types: image/jpeg, image/png, image/gif, image/webp
--
-- También verificar que el bucket comment-images exista con las políticas de fix_09.
-- Si no existe: crear en Storage → New Bucket → nombre: comment-images, Public: SÍ
-- y ejecutar fix_09_storage_bucket.sql

-- ── Lectura pública de image-library ─────────────────────────────────────────
create policy "image_library_read"
  on storage.objects for select
  using (bucket_id = 'image-library');

-- ── Subida solo para admins/superadmins ──────────────────────────────────────
create policy "image_library_upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'image-library'
    and public.my_role() in ('admin', 'superadmin')
    and (storage.extension(name)) in ('jpg', 'jpeg', 'png', 'gif', 'webp')
  );

-- ── Borrar solo admins/superadmins ───────────────────────────────────────────
create policy "image_library_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'image-library'
    and public.my_role() in ('admin', 'superadmin')
  );
