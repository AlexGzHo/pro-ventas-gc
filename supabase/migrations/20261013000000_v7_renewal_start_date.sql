-- Migration: 20261013000000_v7_renewal_start_date.sql
-- Description: Agrega columna start_date a subscription_renewals y actualiza process_renewal con soporte para inicio personalizado/retroactivo, zona horaria Perú y validaciones robustas.

-- 1. Asegurar columna start_date en subscription_renewals para registrar el inicio del período
ALTER TABLE public.subscription_renewals
ADD COLUMN IF NOT EXISTS start_date DATE;

-- 2. Eliminar la versión previa de 4 parámetros para evitar sobrecarga ambigua en PostgREST
DROP FUNCTION IF EXISTS public.process_renewal(UUID, INT, VARCHAR, UUID);

-- 3. Crear RPC process_renewal con parámetro opcional p_start_date
CREATE OR REPLACE FUNCTION public.process_renewal(
    p_subscription_id UUID,
    p_period_value INT,
    p_period_unit VARCHAR,
    p_idempotency_key UUID,
    p_start_date DATE DEFAULT NULL
) RETURNS TABLE (
    renewal_id UUID,
    subscription_id UUID,
    previous_expiry_date DATE,
    new_expiry_date DATE,
    sale_amount_pen NUMERIC,
    cost_amount_pen NUMERIC
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_sub RECORD;
    v_renewal RECORD;
    v_base_date DATE;
    v_new_expiry_date DATE;
    v_unit VARCHAR;
    v_today_lima DATE;
BEGIN
    -- 1. Validar auth
    IF auth.uid() NOT IN (
        '3d8f71db-5e06-4859-92d6-acb57e90b74b'::uuid,
        '742a761c-983e-41ba-864f-9394514d98f5'::uuid
    ) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- 2. Validar parámetros obligatorios y rangos
    IF p_subscription_id IS NULL THEN
        RAISE EXCEPTION 'Subscription ID is required';
    END IF;

    IF p_idempotency_key IS NULL THEN
        RAISE EXCEPTION 'Idempotency key is required';
    END IF;

    IF p_period_value IS NULL OR p_period_value <= 0 THEN
        RAISE EXCEPTION 'Period value must be greater than 0';
    END IF;

    IF p_period_value > 1200 THEN
        RAISE EXCEPTION 'Period value exceeds allowed limit';
    END IF;

    v_unit := lower(trim(p_period_unit));
    IF v_unit NOT IN ('day', 'days', 'month', 'months') THEN
        RAISE EXCEPTION 'Invalid period unit: %', p_period_unit;
    END IF;

    IF p_start_date IS NOT NULL THEN
        IF p_start_date < '2020-01-01'::DATE OR p_start_date > ((CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::DATE + INTERVAL '10 years')::DATE THEN
            RAISE EXCEPTION 'Invalid start date: %', p_start_date;
        END IF;
    END IF;

    -- 3. Verificar existencia idempotente temprana
    SELECT * INTO v_renewal FROM public.subscription_renewals WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
        IF v_renewal.subscription_id != p_subscription_id THEN
            RAISE EXCEPTION 'Idempotency key already used for a different subscription';
        END IF;
        RETURN QUERY SELECT v_renewal.id, v_renewal.subscription_id, v_renewal.previous_expiry_date, v_renewal.new_expiry_date, v_renewal.sale_amount_pen, v_renewal.cost_amount_pen;
        RETURN;
    END IF;

    -- 4. Bloquear suscripción
    SELECT * INTO v_sub FROM public.subscriptions WHERE id = p_subscription_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Subscription not found';
    END IF;

    IF v_sub.archived_at IS NOT NULL THEN
        RAISE EXCEPTION 'Cannot renew an archived subscription';
    END IF;

    -- 5. Re-verificar idempotencia tras adquirir bloqueo
    SELECT * INTO v_renewal FROM public.subscription_renewals WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
        IF v_renewal.subscription_id != p_subscription_id THEN
            RAISE EXCEPTION 'Idempotency key already used for a different subscription';
        END IF;
        RETURN QUERY SELECT v_renewal.id, v_renewal.subscription_id, v_renewal.previous_expiry_date, v_renewal.new_expiry_date, v_renewal.sale_amount_pen, v_renewal.cost_amount_pen;
        RETURN;
    END IF;

    -- 6. Calcular fechas considerando zona horaria de Perú (America/Lima)
    v_today_lima := (CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::DATE;

    IF p_start_date IS NOT NULL THEN
        v_base_date := p_start_date;
    ELSE
        IF v_sub.expiry_date < v_today_lima THEN
            v_base_date := v_today_lima;
        ELSE
            v_base_date := v_sub.expiry_date;
        END IF;
    END IF;

    v_new_expiry_date := (v_base_date + (p_period_value::text || ' ' || v_unit)::interval)::DATE;

    -- 7. Insertar renovación con start_date
    BEGIN
        INSERT INTO public.subscription_renewals (
            subscription_id, idempotency_key, type, start_date, previous_expiry_date, new_expiry_date,
            period_value, period_unit, sale_price, sale_currency, sale_exchange_rate,
            cost, cost_currency, cost_exchange_rate, renewed_by
        ) VALUES (
            p_subscription_id, p_idempotency_key, 'renewal', v_base_date, v_sub.expiry_date, v_new_expiry_date,
            p_period_value, v_unit, v_sub.sale_price, v_sub.sale_price_currency, v_sub.sale_price_exchange_rate,
            v_sub.cost, v_sub.cost_currency, v_sub.cost_exchange_rate, auth.uid()
        ) RETURNING * INTO v_renewal;

        -- 8. Actualizar suscripción
        UPDATE public.subscriptions SET expiry_date = v_new_expiry_date WHERE id = p_subscription_id;

    EXCEPTION WHEN unique_violation THEN
        -- Una transacción concurrente ganó la carrera y registró esta misma key
        SELECT * INTO v_renewal FROM public.subscription_renewals WHERE idempotency_key = p_idempotency_key;
        IF NOT FOUND OR v_renewal.subscription_id != p_subscription_id THEN
            RAISE EXCEPTION 'Idempotency key already used for a different subscription';
        END IF;
    END;

    -- 9. Retornar contrato original
    RETURN QUERY SELECT v_renewal.id, v_renewal.subscription_id, v_renewal.previous_expiry_date, v_renewal.new_expiry_date, v_renewal.sale_amount_pen, v_renewal.cost_amount_pen;
END;
$$;

-- 4. Permisos explícitos con firma completa
REVOKE EXECUTE ON FUNCTION public.process_renewal(UUID, INT, VARCHAR, UUID, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_renewal(UUID, INT, VARCHAR, UUID, DATE) TO authenticated;
