-- ACTIVAR TIEMPO REAL PARA TRASPASOS
-- Esto permite que la lista se actualice automáticamente sin recargar la página
ALTER publication supabase_realtime ADD TABLE public.transfers;
ALTER publication supabase_realtime ADD TABLE public.transfer_items;
