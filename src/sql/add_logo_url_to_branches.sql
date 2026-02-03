-- Add logo_url column to branches table
ALTER TABLE branches 
ADD COLUMN IF NOT EXISTS logo_url TEXT;

COMMENT ON COLUMN branches.logo_url IS 'URL of the branch logo image';
