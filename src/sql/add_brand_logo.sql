-- Migration to add logo_url to brands table
alter table public.brands add column if not exists logo_url text;
