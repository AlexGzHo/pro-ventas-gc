# Arquitectura

```text
Usuario / Liz
     │
     ▼
PRO VENTAS GC
Vite + JavaScript
     │
     ├── Supabase Auth
     │       └── sesión correo + contraseña
     │
     └── Supabase Data API
             └── PostgreSQL
                  └── subscriptions
                       └── RLS

Hosting frontend: Netlify
```

## Flujo de autenticación
1. El usuario introduce correo y contraseña.
2. `supabase.auth.signInWithPassword()` crea la sesión.
3. Supabase guarda y refresca la sesión en el navegador.
4. Sin sesión no se renderiza el dashboard.
5. RLS bloquea accesos de `anon` incluso si alguien intenta llamar directamente a la API.

## Flujo de una venta
1. Se abre Nueva suscripción.
2. Se completan los datos necesarios.
3. El frontend inserta el registro en `subscriptions`.
4. El dashboard se actualiza.
5. Los días restantes y estados se calculan en el navegador a partir de `expiry_date`.

## Flujo de WhatsApp
1. Se obtiene el teléfono del registro.
2. Se genera la plantilla según la acción.
3. Se construye `https://wa.me/<numero>?text=<mensaje>`.
4. Se abre WhatsApp.
5. El envío sigue siendo manual.

## Despliegue
El repositorio se conecta a Netlify o se sube la carpeta `dist` generada con `npm run build`. Netlify necesita las dos variables públicas de Supabase.
