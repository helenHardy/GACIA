-- Políticas de seguridad para el bucket de imágenes
-- Asegúrate de que el bucket 'product-images' ya exista en el Storage

-- 1. Permitir que cualquier persona vea las imágenes (Público)
create policy "Cualquiera puede ver imágenes"
on storage.objects for select
using ( bucket_id = 'product-images' );

-- 2. Permitir que usuarios autenticados suban imágenes
create policy "Usuarios autenticados pueden subir imágenes"
on storage.objects for insert
with check (
    bucket_id = 'product-images' 
    and auth.role() = 'authenticated'
);

-- 3. Permitir que usuarios autenticados actualicen sus imágenes
create policy "Usuarios autenticados pueden actualizar imágenes"
on storage.objects for update
using (
    bucket_id = 'product-images' 
    and auth.role() = 'authenticated'
);

-- 4. Permitir que usuarios autenticados eliminen imágenes
create policy "Usuarios autenticados pueden eliminar imágenes"
on storage.objects for delete
using (
    bucket_id = 'product-images' 
    and auth.role() = 'authenticated'
);
