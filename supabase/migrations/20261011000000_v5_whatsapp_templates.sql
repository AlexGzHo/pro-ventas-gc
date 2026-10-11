-- Migration v5: WhatsApp Templates
-- Stores editable WhatsApp templates for authorized users.

CREATE TABLE public.whatsapp_templates (
    id TEXT PRIMARY KEY CHECK (id IN ('reminder', 'credentials', 'update')),
    content TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

-- Revoke anon access explicitly
REVOKE ALL ON public.whatsapp_templates FROM anon;

-- Grant specific privileges to authenticated
GRANT SELECT, INSERT, UPDATE ON public.whatsapp_templates TO authenticated;

-- Use existing trigger function for updated_at
CREATE TRIGGER set_whatsapp_templates_updated_at
BEFORE UPDATE ON public.whatsapp_templates
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Policies
CREATE POLICY "Allow read access to authorized users"
ON public.whatsapp_templates
FOR SELECT
TO authenticated
USING (
    auth.uid() IN (
        '3d8f71db-5e06-4859-92d6-acb57e90b74b'::uuid,
        '742a761c-983e-41ba-864f-9394514d98f5'::uuid
    )
);

CREATE POLICY "Allow update access to authorized users"
ON public.whatsapp_templates
FOR UPDATE
TO authenticated
USING (
    auth.uid() IN (
        '3d8f71db-5e06-4859-92d6-acb57e90b74b'::uuid,
        '742a761c-983e-41ba-864f-9394514d98f5'::uuid
    )
)
WITH CHECK (
    auth.uid() IN (
        '3d8f71db-5e06-4859-92d6-acb57e90b74b'::uuid,
        '742a761c-983e-41ba-864f-9394514d98f5'::uuid
    )
);

CREATE POLICY "Allow insert access to authorized users"
ON public.whatsapp_templates
FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() IN (
        '3d8f71db-5e06-4859-92d6-acb57e90b74b'::uuid,
        '742a761c-983e-41ba-864f-9394514d98f5'::uuid
    )
);

-- Note: DELETE is not permitted as there are exactly 3 rows intended.

-- Insert default templates
INSERT INTO public.whatsapp_templates (id, content) VALUES
('reminder', '*MENSAJE RECORDATORIO 🚨*

Hola, *{{cliente}}*.
Te quedan *{{dias}}* de tu membresía de *{{servicio}}*.
📅 Vence: *{{vencimiento}}*.'),
('credentials', '✅ *{{servicio}}*
📧 Usuario / correo: *{{usuario}}*
🔐 Contraseña: *{{contrasena}}*
👤 Perfil: *{{perfil}}*
🔢 PIN: *{{pin}}*
🔗 URL: {{url}}
📅 Vence: *{{vencimiento}}*
{{extras}}'),
('update', '✅ *ACTUALIZACIÓN DE DATOS | {{servicio}}*
📧 Usuario / correo: *{{usuario}}*
🔐 Contraseña: *{{contrasena}}*
👤 Perfil: *{{perfil}}*
🔢 PIN: *{{pin}}*
🔗 URL: {{url}}')
ON CONFLICT (id) DO NOTHING;
