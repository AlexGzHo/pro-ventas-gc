# Proyecto

## Nombre
PRO VENTAS GC.

## Propósito
Aplicación web privada para administrar suscripciones digitales y reemplazar el flujo repetitivo del Excel actual.

## Problema actual
El Excel separa servicios en hojas, utiliza fórmulas para alertas y enlaces de WhatsApp, y obliga a copiar datos manualmente. El sistema web centraliza todo en una sola base y calcula estados automáticamente.

## Usuarios
Dos usuarios autorizados: el propietario y Liz. Ambos trabajan sobre la misma información.

## Producto final
Una web alojada en Netlify con login. Después de entrar, permite registrar ventas, consultar vencimientos, copiar accesos, renovar suscripciones y abrir mensajes preparados en WhatsApp.

## Tecnologías
```text
Frontend     Vite + JavaScript + HTML/CSS
Backend      Supabase
Login        Supabase Auth
Base         PostgreSQL
Seguridad    RLS
Hosting      Netlify
Desarrollo   VS Code / Claude Code opcional
```

Claude Code o cualquier API de IA se usa únicamente para programar; no forma parte del funcionamiento final de PRO VENTAS GC.

## Diseño técnico
Se evita crear una tabla por servicio. Netflix, ChatGPT, Gemini, IPTV, Canva y cualquier servicio nuevo se guardan como registros de una misma tabla. Los campos que no aplican quedan vacíos y los datos adicionales se almacenan en `extras`.

## Resultado esperado del MVP
Una persona debe poder entrar, registrar una suscripción y utilizar sus acciones principales sin abrir Excel ni editar código. Agregar un servicio nuevo tampoco debe requerir modificar la base de datos.
