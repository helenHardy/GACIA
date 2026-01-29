-- Add discount column to quotations table
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS discount NUMERIC DEFAULT 0;
