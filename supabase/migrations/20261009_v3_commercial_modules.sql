-- PRO VENTAS GC 3.0 - Migración de Módulos Comerciales
-- Crea tablas de Clientes, Productos y Proveedores, extrae los datos existentes y vincula por Foreign Keys.

-- 1. Crear tablas
CREATE TABLE IF NOT EXISTS public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT,
    notes TEXT,
    created_by UUID DEFAULT auth.uid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    website TEXT,
    whatsapp TEXT,
    telegram TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- La tabla products ya existe en Supabase con sale_price NOT NULL, currency y active.
-- Solo agregamos las columnas nuevas para la v3
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS default_period_value INT,
ADD COLUMN IF NOT EXISTS default_period_unit VARCHAR(10),
ADD COLUMN IF NOT EXISTS default_cost NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS provider_id UUID REFERENCES public.providers(id) ON DELETE SET NULL;

-- Permisos GRANT
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.providers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;

-- 2. Migrar datos existentes (idempotente y preservando exactitud de homónimos)
INSERT INTO public.providers (name)
SELECT DISTINCT provider FROM public.subscriptions s
WHERE provider IS NOT NULL AND provider != ''
AND NOT EXISTS (SELECT 1 FROM public.providers p WHERE p.name = s.provider);

INSERT INTO public.products (
    name,
    sale_price,
    currency,
    active
)
SELECT
    x.service,
    x.sale_price,
    x.currency,
    true
FROM (
    SELECT DISTINCT ON (s.service)
        s.service,
        s.sale_price,
        COALESCE(s.sale_price_currency, 'PEN') AS currency
    FROM public.subscriptions s
    WHERE s.service IS NOT NULL
      AND TRIM(s.service) <> ''
      AND s.sale_price > 0
    ORDER BY
        s.service,
        s.created_at DESC,
        s.id DESC
) AS x
WHERE NOT EXISTS (
    SELECT 1
    FROM public.products p
    WHERE p.name = x.service
);

INSERT INTO public.clients (name, phone)
SELECT client_name, phone
FROM public.subscriptions s
WHERE client_name IS NOT NULL AND client_name != ''
AND NOT EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.name = s.client_name AND COALESCE(c.phone, '') = COALESCE(s.phone, '')
)
GROUP BY client_name, phone;

-- 3. Alterar la tabla de suscripciones principal
ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE RESTRICT,
ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id) ON DELETE RESTRICT,
ADD COLUMN IF NOT EXISTS provider_id UUID REFERENCES public.providers(id) ON DELETE SET NULL;

-- Vincular registros históricos con las nuevas tablas de forma exacta e idempotente
UPDATE public.subscriptions s
SET client_id = (
    SELECT id FROM public.clients c
    WHERE c.name = s.client_name AND COALESCE(c.phone, '') = COALESCE(s.phone, '')
    LIMIT 1
)
WHERE s.client_name IS NOT NULL
AND s.client_id IS NULL
AND (
    SELECT count(*) FROM public.clients c
    WHERE c.name = s.client_name AND COALESCE(c.phone, '') = COALESCE(s.phone, '')
) = 1;

UPDATE public.subscriptions s
SET product_id = (
    SELECT id FROM public.products p
    WHERE p.name = s.service
    LIMIT 1
)
WHERE s.service IS NOT NULL
AND s.product_id IS NULL
AND (
    SELECT count(*) FROM public.products p
    WHERE p.name = s.service
) = 1;

UPDATE public.subscriptions s
SET provider_id = (
    SELECT id FROM public.providers pr
    WHERE pr.name = s.provider
    LIMIT 1
)
WHERE s.provider IS NOT NULL
AND s.provider_id IS NULL
AND (
    SELECT count(*) FROM public.providers pr WHERE pr.name = s.provider
) = 1;

-- 4. Seguridad RLS (Idempotente)
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Access authorized' AND tablename = 'clients') THEN
        CREATE POLICY "Access authorized" ON public.clients FOR ALL TO authenticated USING (auth.uid() IN ('3d8f71db-5e06-4859-92d6-acb57e90b74b'::uuid, '742a761c-983e-41ba-864f-9394514d98f5'::uuid)) WITH CHECK (auth.uid() IN ('3d8f71db-5e06-4859-92d6-acb57e90b74b'::uuid, '742a761c-983e-41ba-864f-9394514d98f5'::uuid));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Access authorized' AND tablename = 'providers') THEN
        CREATE POLICY "Access authorized" ON public.providers FOR ALL TO authenticated USING (auth.uid() IN ('3d8f71db-5e06-4859-92d6-acb57e90b74b'::uuid, '742a761c-983e-41ba-864f-9394514d98f5'::uuid)) WITH CHECK (auth.uid() IN ('3d8f71db-5e06-4859-92d6-acb57e90b74b'::uuid, '742a761c-983e-41ba-864f-9394514d98f5'::uuid));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Access authorized' AND tablename = 'products') THEN
        CREATE POLICY "Access authorized" ON public.products FOR ALL TO authenticated USING (auth.uid() IN ('3d8f71db-5e06-4859-92d6-acb57e90b74b'::uuid, '742a761c-983e-41ba-864f-9394514d98f5'::uuid)) WITH CHECK (auth.uid() IN ('3d8f71db-5e06-4859-92d6-acb57e90b74b'::uuid, '742a761c-983e-41ba-864f-9394514d98f5'::uuid));
    END IF;
END
$$;

-- 5. Crear nueva RPC create_subscription_v3 conservando retrocompatibilidad
CREATE OR REPLACE FUNCTION public.create_subscription_v3(
    p_client_id UUID,
    p_product_id UUID,
    p_provider_id UUID,
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
$$;

REVOKE EXECUTE ON FUNCTION public.create_subscription_v3 FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_subscription_v3 TO authenticated;
