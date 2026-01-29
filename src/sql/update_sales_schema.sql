-- Add sale_number and user_id to sales table
-- 1. Auto-incrementing sale number
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'sale_number') THEN
        ALTER TABLE public.sales ADD COLUMN sale_number SERIAL;
    END IF;
END $$;

-- 2. Link to User Profile (Seller)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'user_id') THEN
        ALTER TABLE public.sales ADD COLUMN user_id uuid REFERENCES public.profiles(id);
    END IF;

    -- Ensure FK constraint exists and is named consistently
    BEGIN
        ALTER TABLE public.sales 
        ADD CONSTRAINT fk_sales_user 
        FOREIGN KEY (user_id) 
        REFERENCES public.profiles(id);
    EXCEPTION
        WHEN duplicate_object THEN 
            NULL; 
    END;
END $$;
