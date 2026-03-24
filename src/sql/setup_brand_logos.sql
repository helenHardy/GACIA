-- ==========================================
-- MIGRATION: BRAND LOGOS STORAGE & SCHEMA
-- ==========================================

-- 1. Add logo_url column to brands table
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- 2. Create Storage Bucket for brand logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('brand-logos', 'brand-logos', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage Policies for 'brand-logos'
-- We drop them first to make the script idempotent (runnable multiple times)
DROP POLICY IF EXISTS "Public Access for Brand Logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload brand logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update brand logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete brand logos" ON storage.objects;

-- 3.1 Allow public access for reading
CREATE POLICY "Public Access for Brand Logos"
ON storage.objects FOR SELECT
USING ( bucket_id = 'brand-logos' );

-- 3.2 Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload brand logos"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'brand-logos' 
    AND auth.role() = 'authenticated'
);

-- 3.3 Allow authenticated users to update/delete
CREATE POLICY "Authenticated users can update brand logos"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'brand-logos' 
    AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can delete brand logos"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'brand-logos' 
    AND auth.role() = 'authenticated'
);
