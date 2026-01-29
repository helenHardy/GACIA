-- Add user_id to purchases table and link to profiles
-- This fixes the error: Could not find a relationship between 'purchases' and 'user_id'

DO $$ 
BEGIN 
    -- 1. Add column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchases' AND column_name = 'user_id') THEN
        ALTER TABLE public.purchases ADD COLUMN user_id uuid REFERENCES public.profiles(id);
    END IF;

    -- 2. If column exists but no FK (rare, but possible if created manually), ensure FK constraint
    -- We can try to add the constraint safely
    BEGIN
        ALTER TABLE public.purchases 
        ADD CONSTRAINT fk_purchases_user 
        FOREIGN KEY (user_id) 
        REFERENCES public.profiles(id);
    EXCEPTION
        WHEN duplicate_object THEN 
            NULL; -- Constraint already exists
    END;
END $$;
