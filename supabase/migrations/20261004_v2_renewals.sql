-- PRO VENTAS GC v2 - Migration
-- Adds subscription_renewals and logical deletion

ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NULL;

CREATE TABLE IF NOT EXISTS public.subscription_renewals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL,
    idempotency_key UUID NOT NULL UNIQUE,
    type VARCHAR(20) NOT NULL,
    previous_expiry_date DATE,
    new_expiry_date DATE NOT NULL,
    period_value INT,
    period_unit VARCHAR(10),
    
    sale_price NUMERIC(10,2) NOT NULL,
    sale_currency VARCHAR(4) NOT NULL,
    sale_exchange_rate NUMERIC(12,6),
    sale_amount_pen NUMERIC(10,2) GENERATED ALWAYS AS (
        CASE 
            WHEN sale_currency = 'PEN' THEN sale_price 
            ELSE ROUND((sale_price * sale_exchange_rate)::numeric, 2) 
        END
    ) STORED,
    
    cost NUMERIC(10,2) NOT NULL,
    cost_currency VARCHAR(4) NOT NULL,
    cost_exchange_rate NUMERIC(12,6),
    cost_amount_pen NUMERIC(10,2) GENERATED ALWAYS AS (
        CASE 
            WHEN cost_currency = 'PEN' THEN cost 
            ELSE ROUND((cost * cost_exchange_rate)::numeric, 2) 
        END
    ) STORED,
    
    renewed_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_subscription FOREIGN KEY (subscription_id) 
        REFERENCES public.subscriptions(id) ON DELETE RESTRICT,
    
    CONSTRAINT chk_type CHECK (type IN ('initial', 'renewal')),
    CONSTRAINT chk_previous_date CHECK (
        (type = 'initial' AND previous_expiry_date IS NULL) OR 
        (type = 'renewal' AND previous_expiry_date IS NOT NULL)
    ),
    CONSTRAINT chk_period CHECK (
        (type = 'initial') OR 
        (type = 'renewal' AND period_value IS NOT NULL AND period_value > 0 AND period_unit IN ('day', 'month'))
    ),
    CONSTRAINT chk_sale_currency CHECK (
        (sale_currency = 'PEN' AND sale_exchange_rate IS NULL) OR 
        (sale_currency = 'USDT' AND sale_exchange_rate IS NOT NULL AND sale_exchange_rate > 0)
    ),
    CONSTRAINT chk_cost_currency CHECK (
        (cost_currency = 'PEN' AND cost_exchange_rate IS NULL) OR 
        (cost_currency = 'USDT' AND cost_exchange_rate IS NOT NULL AND cost_exchange_rate > 0)
    )
);

CREATE INDEX IF NOT EXISTS idx_sub_renewals_created_at ON public.subscription_renewals(created_at);
CREATE INDEX IF NOT EXISTS idx_sub_renewals_sub_id ON public.subscription_renewals(subscription_id);

ALTER TABLE public.subscription_renewals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.subscription_renewals FROM anon;
GRANT SELECT ON TABLE public.subscription_renewals TO authenticated;

-- RLS: Bloquear todo excepto SELECT para los autorizados.
-- Los updates o inserts via API REST directos están bloqueados.
CREATE POLICY "Only authorized users can select renewals"
ON public.subscription_renewals
FOR SELECT
TO authenticated
USING (
  auth.uid() IN (
    '3d8f71db-5e06-4859-92d6-acb57e90b74b'::uuid,
    '742a761c-983e-41ba-864f-9394514d98f5'::uuid
  )
);

CREATE POLICY "Block insert on renewals via REST" ON public.subscription_renewals FOR INSERT WITH CHECK (false);
CREATE POLICY "Block update on renewals via REST" ON public.subscription_renewals FOR UPDATE USING (false);
CREATE POLICY "Block delete on renewals via REST" ON public.subscription_renewals FOR DELETE USING (false);

-- RPC: create_subscription
CREATE OR REPLACE FUNCTION public.create_subscription(
    p_client_name TEXT,
    p_phone TEXT,
    p_service TEXT,
    p_username_email TEXT,
    p_password TEXT,
    p_profile TEXT,
    p_pin TEXT,
    p_access_url TEXT,
    p_sale_price NUMERIC,
    p_cost NUMERIC,
    p_sale_currency TEXT,
    p_cost_currency TEXT,
    p_sale_exchange_rate NUMERIC,
    p_cost_exchange_rate NUMERIC,
    p_provider TEXT,
    p_start_date DATE,
    p_expiry_date DATE,
    p_provider_expiry_date DATE,
    p_extras JSONB,
    p_notes TEXT,
    p_idempotency_key UUID
) RETURNS TABLE (
    subscription_id UUID,
    renewal_id UUID
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
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
$$;
REVOKE EXECUTE ON FUNCTION public.create_subscription FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_subscription TO authenticated;


-- RPC: process_renewal
CREATE OR REPLACE FUNCTION public.process_renewal(
    p_subscription_id UUID,
    p_period_value INT,
    p_period_unit VARCHAR,
    p_idempotency_key UUID
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
$$;
REVOKE EXECUTE ON FUNCTION public.process_renewal FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_renewal TO authenticated;
