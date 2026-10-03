# Excel

## Equivalencia
El Excel original separaba servicios en hojas diferentes. PRO VENTAS GC usa una sola tabla y diferencia cada registro mediante `service`.

Equivalencias principales:

```text
Excel                 PRO VENTAS GC
Cliente               client_name
Celular                phone
Aplicación/hoja        service
Correo/Usuario         username_email
Contraseña             password
Perfil                 profile
PIN                    pin
URL                    access_url
Precio                 sale_price
Costo                  cost
Proveedor              provider
Inicio                 start_date
Vencimiento            expiry_date
Venc. proveedor        provider_expiry_date
Observaciones          notes
Otros datos            extras
```

Las columnas de alerta y días no se guardan: la aplicación las calcula automáticamente a partir del vencimiento.

Los enlaces y textos de WhatsApp tampoco se guardan como fórmulas: se generan al presionar cada botón.
