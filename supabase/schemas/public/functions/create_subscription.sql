CREATE OR REPLACE FUNCTION public.create_subscription (
  p_client_name          text,
  p_phone                text,
  p_service              text,
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
  p_provider             text,
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
BEGIN
    -- Validar auth
    IF auth.uid() NOT IN (
        '3d8f71db-5e06-4859-92d6-acb57e90b74b'::uuid,
        '742a761c-983e-41ba-864f-9394514d98f5'::uuid
    ) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- Insertar base
    INSERT INTO public.subscriptions (
        client_name, phone, service, username_email, password, profile, pin, access_url,
        sale_price, cost, sale_price_currency, cost_currency, sale_price_exchange_rate, cost_exchange_rate,
        provider, start_date, expiry_date, provider_expiry_date, extras, notes, created_by
    ) VALUES (
        p_client_name, p_phone, p_service, p_username_email, p_password, p_profile, p_pin, p_access_url,
        p_sale_price, p_cost, p_sale_currency, p_cost_currency, p_sale_exchange_rate, p_cost_exchange_rate,
        p_provider, p_start_date, p_expiry_date, p_provider_expiry_date, p_extras, p_notes, auth.uid()
    ) RETURNING id INTO v_sub_id;

    -- Insertar historial (la idempotencia de create la maneja la UI, pero si hay doble envío
    -- el unique constraint de p_idempotency_key saltará aquí)
    INSERT INTO public.subscription_renewals (
        subscription_id, idempotency_key, type, previous_expiry_date, new_expiry_date,
        period_value, period_unit, sale_price, sale_currency, sale_exchange_rate,
        cost, cost_currency, cost_exchange_rate, renewed_by
    ) VALUES (
        v_sub_id, p_idempotency_key, 'initial', NULL, p_expiry_date,
        NULL, NULL, p_sale_price, p_sale_currency, p_sale_exchange_rate,
        p_cost, p_cost_currency, p_cost_exchange_rate, auth.uid()
    ) RETURNING id INTO v_ren_id;

    RETURN QUERY SELECT v_sub_id, v_ren_id;
END;
$function$;

GRANT EXECUTE
  ON FUNCTION
    "public"."create_subscription"(text, text, text, text, text, text, text, text, numeric, numeric, text, text, numeric, numeric, text, date, date, date, jsonb, text, uuid)
  TO "anon", "authenticated";

GRANT EXECUTE
  ON FUNCTION
    "public"."create_subscription"(text, text, text, text, text, text, text, text, numeric, numeric, text, text, numeric, numeric, text, date, date, date, jsonb, text, uuid)
  TO "service_role";

REVOKE ALL
  ON FUNCTION
    "public"."create_subscription"(text, text, text, text, text, text, text, text, numeric, numeric, text, text, numeric, numeric, text, date, date, date, jsonb, text, uuid)
  FROM PUBLIC;

REVOKE ALL
  ON FUNCTION
    "public"."create_subscription"(text, text, text, text, text, text, text, text, numeric, numeric, text, text, numeric, numeric, text, date, date, date, jsonb, text, uuid)
  FROM "postgres";

GRANT EXECUTE
  ON FUNCTION
    "public"."create_subscription"(text, text, text, text, text, text, text, text, numeric, numeric, text, text, numeric, numeric, text, date, date, date, jsonb, text, uuid)
  TO "postgres";
