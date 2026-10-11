CREATE OR REPLACE FUNCTION public.process_renewal (
  p_subscription_id uuid,
  p_period_value    integer,
  p_period_unit     character varying,
  p_idempotency_key uuid
)
  RETURNS TABLE (
    renewal_id           uuid,
    subscription_id      uuid,
    previous_expiry_date date,
    new_expiry_date      date,
    sale_amount_pen      numeric,
    cost_amount_pen      numeric
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
  AS $function$
DECLARE
    v_sub RECORD;
    v_renewal RECORD;
    v_base_date DATE;
    v_new_expiry_date DATE;
BEGIN
    -- 1. Validar auth
    IF auth.uid() NOT IN (
        '3d8f71db-5e06-4859-92d6-acb57e90b74b'::uuid,
        '742a761c-983e-41ba-864f-9394514d98f5'::uuid
    ) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- 2. Verificar existencia idempotente temprana
    SELECT * INTO v_renewal FROM public.subscription_renewals WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
        IF v_renewal.subscription_id != p_subscription_id THEN
            RAISE EXCEPTION 'Idempotency key already used for a different subscription';
        END IF;
        RETURN QUERY SELECT v_renewal.id, v_renewal.subscription_id, v_renewal.previous_expiry_date, v_renewal.new_expiry_date, v_renewal.sale_amount_pen, v_renewal.cost_amount_pen;
        RETURN;
    END IF;

    -- 3. Bloquear suscripción
    SELECT * INTO v_sub FROM public.subscriptions WHERE id = p_subscription_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Subscription not found';
    END IF;

    IF v_sub.archived_at IS NOT NULL THEN
        RAISE EXCEPTION 'Cannot renew an archived subscription';
    END IF;

    -- 4. Calcular fechas
    IF v_sub.expiry_date < CURRENT_DATE THEN
        v_base_date := CURRENT_DATE;
    ELSE
        v_base_date := v_sub.expiry_date;
    END IF;

    v_new_expiry_date := (v_base_date + (p_period_value::text || ' ' || p_period_unit)::interval)::DATE;

    -- 5. Insertar renovación (usando bloque anidado para atrapar violación única)
    BEGIN
        INSERT INTO public.subscription_renewals (
            subscription_id, idempotency_key, type, previous_expiry_date, new_expiry_date,
            period_value, period_unit, sale_price, sale_currency, sale_exchange_rate,
            cost, cost_currency, cost_exchange_rate, renewed_by
        ) VALUES (
            p_subscription_id, p_idempotency_key, 'renewal', v_sub.expiry_date, v_new_expiry_date,
            p_period_value, p_period_unit, v_sub.sale_price, v_sub.sale_price_currency, v_sub.sale_price_exchange_rate,
            v_sub.cost, v_sub.cost_currency, v_sub.cost_exchange_rate, auth.uid()
        ) RETURNING * INTO v_renewal;

        -- 6. Actualizar suscripción
        UPDATE public.subscriptions SET expiry_date = v_new_expiry_date WHERE id = p_subscription_id;

    EXCEPTION WHEN unique_violation THEN
        -- Una petición concurrente ganó la carrera y registró esta misma key
        SELECT * INTO v_renewal FROM public.subscription_renewals WHERE idempotency_key = p_idempotency_key;
        IF v_renewal.subscription_id != p_subscription_id THEN
            RAISE EXCEPTION 'Idempotency key already used for a different subscription';
        END IF;
        -- No actualizamos la tabla base porque ya lo hizo la transacción ganadora
    END;

    -- 7. Retornar
    RETURN QUERY SELECT v_renewal.id, v_renewal.subscription_id, v_renewal.previous_expiry_date, v_renewal.new_expiry_date, v_renewal.sale_amount_pen, v_renewal.cost_amount_pen;
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."process_renewal"(uuid, integer, character varying, uuid) TO "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."process_renewal"(uuid, integer, character varying, uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."process_renewal"(uuid, integer, character varying, uuid) FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."process_renewal"(uuid, integer, character varying, uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."process_renewal"(uuid, integer, character varying, uuid) TO "postgres";
