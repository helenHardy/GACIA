-- Hacer que el bucket de imágenes sea público
-- Esto permite que cualquier persona con el link vea las fotos (necesario para la web)

update storage.buckets
set public = true
where id = 'product-images';
