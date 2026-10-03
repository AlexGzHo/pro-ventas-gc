# PRO VENTAS GC

Administrador privado de suscripciones basado en el flujo del Excel original. Está preparado como MVP para dos usuarios: el propietario y Liz.

## Incluye
- Frontend Vite + JavaScript.
- Backend Supabase.
- Login privado.
- RLS.
- CRUD de suscripciones.
- Dashboard.
- Vencimientos automáticos.
- Copiado rápido de credenciales.
- WhatsApp.
- Renovaciones rápidas.
- Responsive.
- Configuración de Netlify.
- Documentación completa del proyecto.
- `CLAUDE.md` para continuar desarrollando con Claude Code.

## Inicio rápido

### 1. Supabase
Crea un proyecto en Supabase. En **SQL Editor > New query**, ejecuta todo `supabase/setup.sql` una sola vez.

### 2. Usuarios
En **Authentication > Users** crea manualmente:
- tu usuario;
- el usuario de Liz.

Desactiva **Allow new users to sign up**. La aplicación no tiene registro público.

### 3. Variables
Copia `.env.example` como `.env` y coloca:

```env
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=TU_CLAVE_PUBLICA
```

Usa únicamente la Publishable Key/Anon Key. Nunca uses `service_role` en este frontend.

### 4. VS Code

```bash
npm install
npm run dev
```

### 5. Build

```bash
npm run build
```

### 6. Netlify
`netlify.toml` ya contiene el comando y la carpeta de publicación. Agrega las dos variables de Supabase en Netlify.

## Documentación
- `docs/PROYECTO.md`: qué estamos construyendo y por qué.
- `docs/MVP.md`: alcance exacto.
- `docs/BACKEND.md`: Supabase, tabla y seguridad.
- `docs/FRONTEND.md`: pantallas y comportamiento.
- `docs/ARQUITECTURA.md`: flujo del sistema.
- `docs/DESPLIEGUE.md`: VS Code y Netlify.
- `docs/EXCEL.md`: equivalencia con el Excel original.
- `docs/ROADMAP.md`: mejoras posteriores.
- `CLAUDE.md`: contexto para Claude Code.
