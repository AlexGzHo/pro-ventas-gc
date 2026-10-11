-- Migración 20261012000000_v6_maintenance_ops.sql
-- Operaciones transaccionales para eliminar y fusionar clientes y proveedores de forma segura.

-- 1. delete_client
CREATE OR REPLACE FUNCTION public.delete_client(p_client_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    v_locked_id UUID;
    v_rows INT;
BEGIN
    IF auth.uid() NOT IN ('3d8f71db-5e06-4859-92d6-acb57e90b74b'::uuid, '742a761c-983e-41ba-864f-9394514d98f5'::uuid) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- Bloqueo explícito del cliente a eliminar
    SELECT id INTO v_locked_id FROM public.clients WHERE id = p_client_id FOR UPDATE;
    IF v_locked_id IS NULL THEN
        RAISE EXCEPTION 'Client not found or already deleted';
    END IF;

    -- Validar que no existan dependencias
    IF EXISTS (SELECT 1 FROM public.subscriptions WHERE client_id = p_client_id) THEN
        RAISE EXCEPTION 'Cannot delete client with active or historical subscriptions';
    END IF;

    DELETE FROM public.clients WHERE id = p_client_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN
        RAISE EXCEPTION 'Failed to delete exact client record';
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_client(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_client(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_client(UUID) TO authenticated;

-- 2. merge_clients
CREATE OR REPLACE FUNCTION public.merge_clients(p_target_client_id UUID, p_source_client_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    v_rows INT;
BEGIN
    IF auth.uid() NOT IN ('3d8f71db-5e06-4859-92d6-acb57e90b74b'::uuid, '742a761c-983e-41ba-864f-9394514d98f5'::uuid) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    IF p_target_client_id = p_source_client_id THEN
        RAISE EXCEPTION 'Target and source clients must be different';
    END IF;

    -- Bloqueo determinista
    IF p_target_client_id < p_source_client_id THEN
        PERFORM 1 FROM public.clients WHERE id = p_target_client_id FOR UPDATE;
        PERFORM 1 FROM public.clients WHERE id = p_source_client_id FOR UPDATE;
    ELSE
        PERFORM 1 FROM public.clients WHERE id = p_source_client_id FOR UPDATE;
        PERFORM 1 FROM public.clients WHERE id = p_target_client_id FOR UPDATE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.clients WHERE id = p_target_client_id) THEN
        RAISE EXCEPTION 'Target client not found';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.clients WHERE id = p_source_client_id) THEN
        RAISE EXCEPTION 'Source client not found';
    END IF;

    -- Reasignar suscripciones (no se sobrescriben campos históricos de texto)
    UPDATE public.subscriptions
    SET client_id = p_target_client_id
    WHERE client_id = p_source_client_id;

    DELETE FROM public.clients WHERE id = p_source_client_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN
        RAISE EXCEPTION 'Failed to delete exact source client record';
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.merge_clients(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.merge_clients(UUID, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.merge_clients(UUID, UUID) TO authenticated;

-- 3. delete_provider
CREATE OR REPLACE FUNCTION public.delete_provider(p_provider_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    v_locked_id UUID;
    v_rows INT;
BEGIN
    IF auth.uid() NOT IN ('3d8f71db-5e06-4859-92d6-acb57e90b74b'::uuid, '742a761c-983e-41ba-864f-9394514d98f5'::uuid) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- Bloqueo explícito
    SELECT id INTO v_locked_id FROM public.providers WHERE id = p_provider_id FOR UPDATE;
    IF v_locked_id IS NULL THEN
        RAISE EXCEPTION 'Provider not found or already deleted';
    END IF;

    -- Validar dependencias (evita que la base de datos aplique SET NULL si existen)
    IF EXISTS (SELECT 1 FROM public.subscriptions WHERE provider_id = p_provider_id) THEN
        RAISE EXCEPTION 'Cannot delete provider with associated subscriptions';
    END IF;

    IF EXISTS (SELECT 1 FROM public.products WHERE provider_id = p_provider_id) THEN
        RAISE EXCEPTION 'Cannot delete provider with associated products';
    END IF;

    DELETE FROM public.providers WHERE id = p_provider_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN
        RAISE EXCEPTION 'Failed to delete exact provider record';
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_provider(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_provider(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_provider(UUID) TO authenticated;

-- 4. merge_providers
CREATE OR REPLACE FUNCTION public.merge_providers(p_target_provider_id UUID, p_source_provider_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    v_rows INT;
BEGIN
    IF auth.uid() NOT IN ('3d8f71db-5e06-4859-92d6-acb57e90b74b'::uuid, '742a761c-983e-41ba-864f-9394514d98f5'::uuid) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    IF p_target_provider_id = p_source_provider_id THEN
        RAISE EXCEPTION 'Target and source providers must be different';
    END IF;

    -- Bloqueo determinista
    IF p_target_provider_id < p_source_provider_id THEN
        PERFORM 1 FROM public.providers WHERE id = p_target_provider_id FOR UPDATE;
        PERFORM 1 FROM public.providers WHERE id = p_source_provider_id FOR UPDATE;
    ELSE
        PERFORM 1 FROM public.providers WHERE id = p_source_provider_id FOR UPDATE;
        PERFORM 1 FROM public.providers WHERE id = p_target_provider_id FOR UPDATE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.providers WHERE id = p_target_provider_id) THEN
        RAISE EXCEPTION 'Target provider not found';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.providers WHERE id = p_source_provider_id) THEN
        RAISE EXCEPTION 'Source provider not found';
    END IF;

    -- Reasignar productos
    UPDATE public.products
    SET provider_id = p_target_provider_id
    WHERE provider_id = p_source_provider_id;

    -- Reasignar suscripciones (no se sobrescriben campos históricos de texto)
    UPDATE public.subscriptions
    SET provider_id = p_target_provider_id
    WHERE provider_id = p_source_provider_id;

    DELETE FROM public.providers WHERE id = p_source_provider_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN
        RAISE EXCEPTION 'Failed to delete exact source provider record';
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.merge_providers(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.merge_providers(UUID, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.merge_providers(UUID, UUID) TO authenticated;
