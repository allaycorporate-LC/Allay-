-- ─────────────────────────────────────────────────────────────────────────────
-- Fix #9: Storage bucket comment-images — políticas y límites
--
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query
--
-- ANTES de ejecutar este script:
--   1. Ir a Dashboard → Storage → New Bucket
--   2. Nombre: comment-images
--   3. Public bucket: SÍ (necesario para getPublicUrl)
--   4. File size limit: 5242880 (5 MB)
--   5. Allowed MIME types: image/jpeg, image/png, image/gif, image/webp
-- ─────────────────────────────────────────────────────────────────────────────


-- ── Upload: solo usuarios autenticados pueden subir ───────────────────────────
-- El path tiene formato: comments/TIMESTAMP_RANDOM.ext
-- Solo puede subir el usuario autenticado (el path no se valida por usuario
-- porque las imágenes son públicas en el feed).

create policy "comment_images_upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'comment-images'
    -- Solo extensiones de imagen permitidas
    and (storage.extension(name)) in ('jpg', 'jpeg', 'png', 'gif', 'webp')
    -- El path debe estar dentro de la carpeta comments/
    and (storage.foldername(name))[1] = 'comments'
  );


-- ── Lectura pública ───────────────────────────────────────────────────────────
-- Las imágenes de comentarios son visibles a todos (el bucket es público).
-- Esta policy cubre getPublicUrl y la descarga directa.

create policy "comment_images_read"
  on storage.objects for select
  using (bucket_id = 'comment-images');


-- ── Delete: solo admins/superadmins pueden borrar ────────────────────────────
-- Los usuarios comunes no pueden borrar imágenes (evita que borren
-- imágenes de comentarios ajenos). Admins pueden moderar.

create policy "comment_images_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'comment-images'
    and public.my_role() in ('admin', 'superadmin')
  );


-- ── Verificación ──────────────────────────────────────────────────────────────
-- Después de ejecutar, verificá con:
--
--   select policyname, operation, definition
--   from storage.policies
--   where bucket_id = 'comment-images';
--
-- Y desde Dashboard → Storage → comment-images → Policies debería mostrar
-- las tres políticas: upload, read, delete.
