CREATE TABLE "public"."providers" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "name"       text                     NOT NULL,
  "website"    text,
  "whatsapp"   text,
  "telegram"   text,
  "notes"      text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "providers_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."providers"
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access authorized" ON "public"."providers"
  FOR ALL
  TO "authenticated"
  USING ((auth.uid() = ANY (ARRAY['3d8f71db-5e06-4859-92d6-acb57e90b74b'::uuid, '742a761c-983e-41ba-864f-9394514d98f5'::uuid])))
  WITH CHECK ((auth.uid() = ANY (ARRAY['3d8f71db-5e06-4859-92d6-acb57e90b74b'::uuid, '742a761c-983e-41ba-864f-9394514d98f5'::uuid])));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."providers" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."providers" TO "service_role";

REVOKE ALL ON TABLE "public"."providers" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."providers" TO "postgres";
