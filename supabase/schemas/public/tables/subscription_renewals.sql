CREATE TABLE "public"."subscription_renewals" (
  "id"                   uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "subscription_id"      uuid                     NOT NULL,
  "idempotency_key"      uuid                     NOT NULL,
  "type"                 character varying(20)    NOT NULL,
  "previous_expiry_date" date,
  "new_expiry_date"      date                     NOT NULL,
  "period_value"         integer,
  "period_unit"          character varying(10),
  "sale_price"           numeric(10,2)            NOT NULL,
  "sale_currency"        character varying(4)     NOT NULL,
  "sale_exchange_rate"   numeric(12,6),
  "cost"                 numeric(10,2)            NOT NULL,
  "cost_currency"        character varying(4)     NOT NULL,
  "cost_exchange_rate"   numeric(12,6),
  "renewed_by"           uuid                     NOT NULL,
  "created_at"           timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "chk_cost_currency"
    CHECK (((((cost_currency)::text = 'PEN'::text) AND (cost_exchange_rate IS NULL)) OR (((cost_currency)::text = 'USDT'::text) AND (cost_exchange_rate IS
    NOT NULL) AND (cost_exchange_rate > (0)::numeric)))),
  CONSTRAINT "chk_period" CHECK ((((type)::text = 'initial'::text) OR (((type)::text = 'renewal'::text) AND (period_value IS
    NOT NULL) AND (period_value > 0) AND ((period_unit)::text = ANY ((ARRAY['day'::character varying, 'month'::character varying])::text[]))))),
  CONSTRAINT "chk_previous_date" CHECK (((((type)::text = 'initial'::text) AND (previous_expiry_date IS NULL)) OR (((type)::text = 'renewal'::text) AND (previous_expiry_date IS
    NOT NULL)))),
  CONSTRAINT "chk_sale_currency"
    CHECK (((((sale_currency)::text = 'PEN'::text) AND (sale_exchange_rate IS NULL)) OR (((sale_currency)::text = 'USDT'::text) AND (sale_exchange_rate IS
    NOT NULL) AND (sale_exchange_rate > (0)::numeric)))),
  CONSTRAINT "chk_type" CHECK (((type)::text = ANY ((ARRAY['initial'::character varying, 'renewal'::character varying])::text[]))),
  CONSTRAINT "subscription_renewals_idempotency_key_key" UNIQUE (idempotency_key),
  CONSTRAINT "subscription_renewals_pkey" PRIMARY KEY (id),
  CONSTRAINT "fk_subscription" FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(id) ON DELETE RESTRICT
);

ALTER TABLE "public"."subscription_renewals"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."subscription_renewals"
  ADD COLUMN "sale_amount_pen" numeric(10,2) GENERATED ALWAYS AS (
CASE
    WHEN ((sale_currency)::text = 'PEN'::text) THEN sale_price
    ELSE round((sale_price * sale_exchange_rate), 2)
END) STORED;

ALTER TABLE "public"."subscription_renewals"
  ADD COLUMN "cost_amount_pen" numeric(10,2) GENERATED ALWAYS AS (
CASE
    WHEN ((cost_currency)::text = 'PEN'::text) THEN COST
    ELSE round((COST * cost_exchange_rate), 2)
END) STORED;

CREATE INDEX idx_sub_renewals_created_at ON public.subscription_renewals USING btree (created_at);

CREATE INDEX idx_sub_renewals_sub_id ON public.subscription_renewals USING btree (subscription_id);

CREATE POLICY "Block delete on renewals via REST" ON "public"."subscription_renewals"
  FOR DELETE
  TO PUBLIC
  USING (false);

CREATE POLICY "Block insert on renewals via REST" ON "public"."subscription_renewals"
  FOR INSERT
  TO PUBLIC
  WITH CHECK (false);

CREATE POLICY "Block update on renewals via REST" ON "public"."subscription_renewals"
  FOR UPDATE
  TO PUBLIC
  USING (false);

CREATE POLICY "Only authorized users can select renewals" ON "public"."subscription_renewals"
  FOR SELECT
  TO "authenticated"
  USING ((auth.uid() = ANY (ARRAY['3d8f71db-5e06-4859-92d6-acb57e90b74b'::uuid, '742a761c-983e-41ba-864f-9394514d98f5'::uuid])));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."subscription_renewals" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."subscription_renewals" TO "service_role";

REVOKE ALL ON TABLE "public"."subscription_renewals" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."subscription_renewals" TO "postgres";

REVOKE ALL ON TABLE "public"."subscription_renewals" FROM "anon";
