-- =====================================================
-- CORRECCIÓN: REVERSIÓN DE STOCK AL ELIMINAR TRASPASOS EN TRÁNSITO
-- =====================================================
-- Problema: handle_transfer_delete solo revertía cuando el traspaso
-- estaba 'Recibido'. Si se eliminaba uno en estado 'Enviado', el stock
-- ya descontado del origen se perdía (ni volvía a origen ni llegaba a destino).
--
-- Solución: También devolver el stock al origen cuando old.status = 'Enviado'.
-- (Pendiente/Cancelado no requieren reversion porque no hay stock en movimiento.)
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_transfer_delete()
RETURNS trigger AS $$
DECLARE
    t_item record;
    v_origin_stock numeric;
    v_dest_stock numeric;
BEGIN
    -- CASO 1: Eliminación de un traspaso ya RECIBIDO
    -- Se devuelve el stock al origen y se quita del destino.
    IF old.status = 'Recibido' THEN
        FOR t_item IN SELECT * FROM public.transfer_items WHERE transfer_id = old.id LOOP
            v_origin_stock := public.update_branch_stock(t_item.product_id, old.origin_branch_id, t_item.quantity);
            v_dest_stock := public.update_branch_stock(t_item.product_id, old.destination_branch_id, -t_item.quantity);

            INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
            VALUES (old.origin_branch_id, t_item.product_id, 'TRASPASO_ELIMINADO', t_item.quantity, v_origin_stock, old.id::text, 'Traspaso recibido eliminado (reversión stock)');
        END LOOP;

    -- CASO 2: Eliminación de un traspaso EN TRÁNSITO (Enviado)
    -- Solo se devuelve el stock al origen (el destino nunca lo recibió).
    ELSIF old.status = 'Enviado' THEN
        FOR t_item IN SELECT * FROM public.transfer_items WHERE transfer_id = old.id LOOP
            v_origin_stock := public.update_branch_stock(t_item.product_id, old.origin_branch_id, t_item.quantity);

            INSERT INTO public.kardex (branch_id, product_id, type, quantity, balance_after, reference_id, notes)
            VALUES (old.origin_branch_id, t_item.product_id, 'TRASPASO_ELIMINADO', t_item.quantity, v_origin_stock, old.id::text, 'Traspaso en tránsito eliminado (retorno a origen)');
        END LOOP;
    END IF;

    RETURN old;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Asegurar que el trigger exista (idempotente)
DROP TRIGGER IF EXISTS trg_kardex_transfer_delete ON public.transfers;
CREATE TRIGGER trg_kardex_transfer_delete
BEFORE DELETE ON public.transfers
FOR EACH ROW EXECUTE FUNCTION public.handle_transfer_delete();
