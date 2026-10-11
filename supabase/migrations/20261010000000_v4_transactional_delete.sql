-- PRO VENTAS GC
-- Migración v4: Eliminación transaccional de suscripciones con historial

CREATE OR REPLACE FUNCTION public.delete_subscription_transactional(p_sub_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
    IF auth.uid() IS NULL OR auth.uid() NOT IN (
        '3d8f71db-5e06-4859-92d6-acb57e90b74b'::uuid,
        '742a761c-983e-41ba-864f-9394514d98f5'::uuid
    ) THEN
        RAISE EXCEPTION 'No autorizado para eliminar suscripciones.';
    END IF;

    PERFORM 1
    FROM public.subscriptions
    WHERE id = p_sub_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La suscripción especificada no existe.';
    END IF;

    DELETE FROM public.subscription_renewals
    WHERE subscription_id = p_sub_id;

    DELETE FROM public.subscriptions
    WHERE id = p_sub_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se pudo eliminar la suscripción.';
    END IF;
END;
$$;

-- Permisos Mínimos
REVOKE ALL ON FUNCTION public.delete_subscription_transactional(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_subscription_transactional(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_subscription_transactional(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_subscription_transactional(uuid) TO service_role;
