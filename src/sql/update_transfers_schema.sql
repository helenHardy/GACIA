-- Add transfer_number and tracking columns to transfers table
-- 1. Auto-incrementing transfer number
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transfers' AND column_name = 'transfer_number') THEN
        ALTER TABLE public.transfers ADD COLUMN transfer_number SERIAL;
    END IF;
END $$;

-- 2. Link to User Profile (Sender/Receiver)
DO $$ 
BEGIN 
    -- sent_by
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transfers' AND column_name = 'sent_by') THEN
        ALTER TABLE public.transfers ADD COLUMN sent_by uuid REFERENCES public.profiles(id);
    END IF;

    -- received_by
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transfers' AND column_name = 'received_by') THEN
        ALTER TABLE public.transfers ADD COLUMN received_by uuid REFERENCES public.profiles(id);
    END IF;

    -- Ensure FK constraints exist
    BEGIN
        ALTER TABLE public.transfers 
        ADD CONSTRAINT fk_transfers_sender 
        FOREIGN KEY (sent_by) 
        REFERENCES public.profiles(id);
    EXCEPTION
        WHEN duplicate_object THEN 
            NULL; 
    END;

    BEGIN
        ALTER TABLE public.transfers 
        ADD CONSTRAINT fk_transfers_receiver 
        FOREIGN KEY (received_by) 
        REFERENCES public.profiles(id);
    EXCEPTION
        WHEN duplicate_object THEN 
            NULL; 
    END;
END $$;
