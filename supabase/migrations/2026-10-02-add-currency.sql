-- PRO VENTAS GC
-- Migración: soporte de importes en PEN y USDT.
-- Idempotente: puede ejecutarse una o varias veces. Preserva todos los registros actuales.
--
-- Cambios:
-- 1. sale_currency / cost_currency: moneda original del importe ('PEN' | 'USDT'), default 'PEN'.
-- 2. sale_exchange_rate / cost_exchange_rate: tipo de cambio USDT->PEN registrado en la operación.
--    Se guarda por registro, por lo que el valor histórico NO cambia si luego cambia el tipo de cambio.
-- 3. Registros existentes quedan en PEN sin TC (comportamiento anterior, sin recrearlos).

alter table public.subscriptions
  add column if not exists sale_currency text not null default 'PEN'
    check (sale_currency in ('PEN', 'USDT'));

alter table public.subscriptions
  add column if not exists cost_currency text not null default 'PEN'
    check (cost_currency in ('PEN', 'USDT'));

alter table public.subscriptions
  add column if not exists sale_exchange_rate numeric(12,6);

alter table public.subscriptions
  add column if not exists cost_exchange_rate numeric(12,6);

-- Tipo de cambio solo aplica a importes en USDT; en PEN debe ser nulo.
-- Esta corrección solo normaliza registros inconsistentes (PEN con TC asignado);
-- no altera importes históricos válidos.
update public.subscriptions
  set sale_exchange_rate = null
  where sale_currency = 'PEN' and sale_exchange_rate is not null;

update public.subscriptions
  set cost_exchange_rate = null
  where cost_currency = 'PEN' and cost_exchange_rate is not null;

-- Índices opcionales para consultar importes en USDT (vista de gastos en USDT).
create index if not exists subscriptions_sale_currency_idx
  on public.subscriptions (sale_currency);

create index if not exists subscriptions_cost_currency_idx
  on public.subscriptions (cost_currency);
