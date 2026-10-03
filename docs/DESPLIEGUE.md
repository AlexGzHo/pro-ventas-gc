# Despliegue

## Desarrollo local
Crear `.env` a partir de `.env.example`:

```env
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=TU_CLAVE_PUBLICA
```

Después:

```bash
npm install
npm run dev
```

## Producción
Comprobar:

```bash
npm run build
```

La salida queda en `dist`.

## Netlify
El archivo `netlify.toml` ya define:
- comando: `npm run build`;
- publicación: `dist`;
- redirección a `index.html`.

En Site configuration > Environment variables agregar:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Nunca agregar una `service_role` al frontend.
