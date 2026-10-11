CREATE TABLE "public"."clients" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "name"       text                     NOT NULL,
  "phone"      text,
  "notes"      text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "clients_pkey" PRIMARY KEY (id),
  "created_by" uuid                     DEFAULT auth.uid()
);

ALTER TABLE "public"."clients"
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access authorized" ON "public"."clients"
  FOR ALL
  TO "authenticated"
  USING ((auth.uid() = ANY (ARRAY['3d8f71db-5e06-4859-92d6-acb57e90b74b'::uuid, '742a761c-983e-41ba-864f-9394514d98f5'::uuid])))
  WITH CHECK ((auth.uid() = ANY (ARRAY['3d8f71db-5e06-4859-92d6-acb57e90b74b'::uuid, '742a761c-983e-41ba-864f-9394514d98f5'::uuid])));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."clients" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."clients" TO "service_role";

REVOKE ALL ON TABLE "public"."clients" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."clients" TO "postgres";
