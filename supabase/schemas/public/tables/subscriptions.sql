CREATE TABLE "public"."subscriptions" (
  "id"                       uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "client_name"              text                     NOT NULL,
  "phone"                    text,
  "service"                  text                     NOT NULL,
  "username_email"           text,
  "password"                 text,
  "profile"                  text,
  "pin"                      text,
  "access_url"               text,
  "sale_price"               numeric(10,2)            NOT NULL DEFAULT 0,
  "cost"                     numeric(10,2)            NOT NULL DEFAULT 0,
  "provider"                 text,
  "start_date"               date                     DEFAULT CURRENT_DATE,
  "expiry_date"              date                     NOT NULL,
  "provider_expiry_date"     date,
  "extras"                   jsonb                    NOT NULL DEFAULT '{}'::jsonb,
  "notes"                    text,
  "created_at"               timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"               timestamp with time zone NOT NULL DEFAULT now(),
  "sale_price_currency"      text                     DEFAULT 'PEN'::text,
  "cost_currency"            text                     DEFAULT 'PEN'::text,
  "sale_price_exchange_rate" numeric,
  "cost_exchange_rate"       numeric,
  "archived_at"              timestamp with time zone,
  "client_id"                uuid,
  "product_id"               uuid,
  "provider_id"              uuid,
  CONSTRAINT "subscriptions_client_id_fkey" FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT,
  CONSTRAINT "subscriptions_cost_check" CHECK ((cost >= (0)::numeric)),
  CONSTRAINT "subscriptions_cost_rate_check" CHECK ((((cost_currency = 'PEN'::text) AND (cost_exchange_rate IS NULL)) OR ((cost_currency = 'USDT'::text) AND (cost_exchange_rate IS
    NOT NULL) AND (cost_exchange_rate > (0)::numeric)))),
  CONSTRAINT "subscriptions_pkey" PRIMARY KEY (id),
  CONSTRAINT "subscriptions_product_id_fkey" FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT,
  CONSTRAINT "subscriptions_provider_id_fkey" FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE SET NULL,
  CONSTRAINT "subscriptions_sale_price_check" CHECK ((sale_price >= (0)::numeric)),
  CONSTRAINT "subscriptions_sale_price_rate_check"
    CHECK ((((sale_price_currency = 'PEN'::text) AND (sale_price_exchange_rate IS NULL)) OR ((sale_price_currency = 'USDT'::text) AND (sale_price_exchange_rate IS
    NOT NULL) AND (sale_price_exchange_rate > (0)::numeric)))),
  "created_by"               uuid                     DEFAULT auth.uid()
);

ALTER TABLE "public"."subscriptions"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX subscriptions_client_idx ON public.subscriptions USING btree (client_name);

CREATE INDEX subscriptions_expiry_idx ON public.subscriptions USING btree (expiry_date);

CREATE INDEX subscriptions_service_idx ON public.subscriptions USING btree (service);

CREATE TRIGGER subscriptions_set_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "Only authorized users access subscriptions" ON "public"."subscriptions"
  FOR ALL
  TO "authenticated"
  USING ((auth.uid() = ANY (ARRAY['3d8f71db-5e06-4859-92d6-acb57e90b74b'::uuid, '742a761c-983e-41ba-864f-9394514d98f5'::uuid])))
  WITH CHECK ((auth.uid() = ANY (ARRAY['3d8f71db-5e06-4859-92d6-acb57e90b74b'::uuid, '742a761c-983e-41ba-864f-9394514d98f5'::uuid])));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."subscriptions" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."subscriptions" TO "service_role";

REVOKE ALL ON TABLE "public"."subscriptions" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."subscriptions" TO "postgres";

REVOKE ALL ON TABLE "public"."subscriptions" FROM "anon";
