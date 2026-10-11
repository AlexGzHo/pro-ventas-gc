CREATE OR REPLACE FUNCTION public.create_subscription_v3 (
  p_client_id            uuid,
  p_product_id           uuid,
  p_provider_id          uuid,
  p_username_email       text,
  p_password             text,
  p_profile              text,
  p_pin                  text,
  p_access_url           text,
  p_sale_price           numeric,
  p_cost                 numeric,
  p_sale_currency        text,
  p_cost_currency        text,
  p_sale_exchange_rate   numeric,
  p_cost_exchange_rate   numeric,
  p_start_date           date,
  p_expiry_date          date,
  p_provider_expiry_date date,
  p_extras               jsonb,
  p_notes                text,
  p_idempotency_key      uuid
)
  RETURNS TABLE (
    subscription_id uuid,
    renewal_id      uuid
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
  AS $function$
DECLARE
    v_sub_id UUID;
    v_ren_id UUID;
    v_client_name TEXT;
    v_phone TEXT;
    v_service TEXT;
    v_provider TEXT;
    v_period_value INT;
    v_period_unit VARCHAR(10);
BEGIN
    -- Validaciones de autorización
    IF auth.uid() NOT IN ('3d8f71db-5e06-4859-92d6-acb57e90b74b'::uuid, '742a761c-983e-41ba-864f-9394514d98f5'::uuid) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- Validaciones de existencia obligatoria
    IF p_client_id IS NULL THEN
        RAISE EXCEPTION 'p_client_id is required';
    ELSIF NOT EXISTS (SELECT 1 FROM public.clients WHERE id = p_client_id) THEN
        RAISE EXCEPTION 'Client % does not exist', p_client_id;
    END IF;

    IF p_product_id IS NULL THEN
        RAISE EXCEPTION 'p_product_id is required';
    ELSIF NOT EXISTS (SELECT 1 FROM public.products WHERE id = p_product_id) THEN
        RAISE EXCEPTION 'Product % does not exist', p_product_id;
    END IF;

    IF p_provider_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.providers WHERE id = p_provider_id) THEN
        RAISE EXCEPTION 'Provider % does not exist', p_provider_id;
    END IF;

    IF p_idempotency_key IS NULL THEN
        RAISE EXCEPTION 'p_idempotency_key is required';
    END IF;

    -- Calcular periodo sin inventar si no cuadra exacto
    v_period_value := NULL;
    v_period_unit := NULL;
    IF p_start_date IS NOT NULL AND p_expiry_date IS NOT NULL THEN
        IF p_expiry_date = p_start_date + INTERVAL '7 days' THEN
            v_period_value := 7; v_period_unit := 'day';
        ELSIF p_expiry_date = p_start_date + INTERVAL '15 days' THEN
            v_period_value := 15; v_period_unit := 'day';
        ELSIF p_expiry_date = p_start_date + INTERVAL '1 month' THEN
            v_period_value := 1; v_period_unit := 'month';
        ELSIF p_expiry_date = p_start_date + INTERVAL '3 months' THEN
            v_period_value := 3; v_period_unit := 'month';
        ELSIF p_expiry_date = p_start_date + INTERVAL '6 months' THEN
            v_period_value := 6; v_period_unit := 'month';
        ELSIF p_expiry_date = p_start_date + INTERVAL '12 months' THEN
            v_period_value := 12; v_period_unit := 'month';
        END IF;
    END IF;

    -- Obtener datos de texto para mantener retrocompatibilidad
    SELECT name, phone INTO v_client_name, v_phone FROM public.clients WHERE id = p_client_id;
    SELECT name INTO v_service FROM public.products WHERE id = p_product_id;
    IF p_provider_id IS NOT NULL THEN
        SELECT name INTO v_provider FROM public.providers WHERE id = p_provider_id;
    END IF;

    BEGIN
        INSERT INTO public.subscriptions (
            client_id, product_id, provider_id, username_email, password, profile, pin, access_url,
            sale_price, cost, sale_price_currency, cost_currency, sale_price_exchange_rate, cost_exchange_rate,
            start_date, expiry_date, provider_expiry_date, extras, notes, created_by,
            client_name, phone, service, provider
        ) VALUES (
            p_client_id, p_product_id, p_provider_id, p_username_email, p_password, p_profile, p_pin, p_access_url,
            p_sale_price, p_cost, p_sale_currency, p_cost_currency, p_sale_exchange_rate, p_cost_exchange_rate,
            p_start_date, p_expiry_date, p_provider_expiry_date, p_extras, p_notes, auth.uid(),
            v_client_name, v_phone, v_service, v_provider
        ) RETURNING id INTO v_sub_id;

        INSERT INTO public.subscription_renewals (
            subscription_id, idempotency_key, type, previous_expiry_date, new_expiry_date,
            period_value, period_unit, sale_price, sale_currency, sale_exchange_rate,
            cost, cost_currency, cost_exchange_rate, renewed_by
        ) VALUES (
            v_sub_id, p_idempotency_key, 'initial', NULL, p_expiry_date,
            v_period_value, v_period_unit, p_sale_price, p_sale_currency, p_sale_exchange_rate,
            p_cost, p_cost_currency, p_cost_exchange_rate, auth.uid()
        ) RETURNING id INTO v_ren_id;

        RETURN QUERY SELECT v_sub_id, v_ren_id;
    EXCEPTION WHEN unique_violation THEN
        -- Control exacto de reintentos concurrentes de idempotency_key (comportamiento v2 preservado)
        SELECT public.subscription_renewals.id, public.subscription_renewals.subscription_id
        INTO v_ren_id, v_sub_id
        FROM public.subscription_renewals
        WHERE idempotency_key = p_idempotency_key;

        IF FOUND THEN
            RETURN QUERY SELECT v_sub_id, v_ren_id;
        ELSE
            RAISE; -- Fue otra violación única
        END IF;
    END;
END;
$function$;

GRANT EXECUTE
  ON FUNCTION "public"."create_subscription_v3"(uuid, uuid, uuid, text, text, text, text, text, numeric, numeric, text, text, numeric, numeric, date, date, date, jsonb, text, uuid)
  TO "anon", "authenticated";

GRANT EXECUTE
  ON FUNCTION "public"."create_subscription_v3"(uuid, uuid, uuid, text, text, text, text, text, numeric, numeric, text, text, numeric, numeric, date, date, date, jsonb, text, uuid)
  TO "service_role";

REVOKE ALL
  ON FUNCTION "public"."create_subscription_v3"(uuid, uuid, uuid, text, text, text, text, text, numeric, numeric, text, text, numeric, numeric, date, date, date, jsonb, text, uuid)
  FROM PUBLIC;

REVOKE ALL
  ON FUNCTION "public"."create_subscription_v3"(uuid, uuid, uuid, text, text, text, text, text, numeric, numeric, text, text, numeric, numeric, date, date, date, jsonb, text, uuid)
  FROM "postgres";

GRANT EXECUTE
  ON FUNCTION "public"."create_subscription_v3"(uuid, uuid, uuid, text, text, text, text, text, numeric, numeric, text, text, numeric, numeric, date, date, date, jsonb, text, uuid)
  TO "postgres";
