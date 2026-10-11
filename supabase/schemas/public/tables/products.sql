CREATE TABLE "public"."products" (
  "id"                   uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "name"                 text                     NOT NULL,
  "sale_price"           numeric(10,2)            NOT NULL,
  "currency"             text                     NOT NULL DEFAULT 'PEN'::text,
  "active"               boolean                  NOT NULL DEFAULT true,
  "created_at"           timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"           timestamp with time zone NOT NULL DEFAULT now(),
  "logo_url"             text,
  "description"          text,
  "default_period_value" integer,
  "default_period_unit"  character varying(10),
  "default_cost"         numeric(10,2),
  "provider_id"          uuid,
  CONSTRAINT "products_currency_allowed" CHECK ((currency = ANY (ARRAY['PEN'::text, 'USDT'::text]))),
  CONSTRAINT "products_name_not_empty" CHECK ((length(TRIM(BOTH FROM name)) > 0)),
  CONSTRAINT "products_pkey" PRIMARY KEY (id),
  CONSTRAINT "products_sale_price_positive" CHECK ((sale_price > (0)::numeric)),
  CONSTRAINT "products_provider_id_fkey" FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE SET NULL
);

ALTER TABLE "public"."products"
  ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX products_name_unique_idx ON public.products USING btree (upper(TRIM(BOTH FROM name)));

CREATE TRIGGER products_set_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "Access authorized" ON "public"."products"
  FOR ALL
  TO "authenticated"
  USING ((auth.uid() = ANY (ARRAY['3d8f71db-5e06-4859-92d6-acb57e90b74b'::uuid, '742a761c-983e-41ba-864f-9394514d98f5'::uuid])))
  WITH CHECK ((auth.uid() = ANY (ARRAY['3d8f71db-5e06-4859-92d6-acb57e90b74b'::uuid, '742a761c-983e-41ba-864f-9394514d98f5'::uuid])));

CREATE POLICY "Authorized users can insert products" ON "public"."products"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((( SELECT auth.uid() AS uid) = ANY (ARRAY['3d8f71db-5e06-4859-92d6-acb57e90b74b'::uuid, '742a761c-983e-41ba-864f-9394514d98f5'::uuid])));

CREATE POLICY "Authorized users can read products" ON "public"."products"
  FOR SELECT
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = ANY (ARRAY['3d8f71db-5e06-4859-92d6-acb57e90b74b'::uuid, '742a761c-983e-41ba-864f-9394514d98f5'::uuid])));

CREATE POLICY "Authorized users can update products" ON "public"."products"
  FOR UPDATE
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = ANY (ARRAY['3d8f71db-5e06-4859-92d6-acb57e90b74b'::uuid, '742a761c-983e-41ba-864f-9394514d98f5'::uuid])))
  WITH CHECK ((( SELECT auth.uid() AS uid) = ANY (ARRAY['3d8f71db-5e06-4859-92d6-acb57e90b74b'::uuid, '742a761c-983e-41ba-864f-9394514d98f5'::uuid])));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."products" TO "service_role";

REVOKE ALL ON TABLE "public"."products" FROM "authenticated";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."products" TO "authenticated";

REVOKE ALL ON TABLE "public"."products" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."products" TO "postgres";

REVOKE ALL ON TABLE "public"."products" FROM "anon";
