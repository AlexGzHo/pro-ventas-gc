-- PRO VENTAS GC — Migración: soporte de importes en PEN y USDT.
-- Ejecutar una sola vez en Supabase > SQL Editor.
--
-- Esta migración PRESERVA todos los registros existentes:
-- los importes actuales quedan marcados como PEN ('S/') con tipo de cambio nulo,
-- por lo que los totales en soles no cambian.
--
-- Reglas:
--   - sale_price_currency / cost_currency: 'PEN' (predeterminado) o 'USDT'.
--   - Si la moneda es USDT, el tipo de cambio (S/ por 1 USDT) es obligatorio y > 0.
--   - El tipo de cambio se guarda POR OPERACIÓN: el valor histórico no cambia
--     aunque el tipo de cambio de mercado varíe después.

alter table public.subscriptions
  add column if not exists sale_price_currency text not null default 'PEN',
  add column if not exists cost_currency text not null default 'PEN',
  add column if not exists sale_price_exchange_rate numeric(12,4),
  add column if not exists cost_exchange_rate numeric(12,4);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'subscriptions_sale_price_currency_check') then
    alter table public.subscriptions
      add constraint subscriptions_sale_price_currency_check
      check (sale_price_currency in ('PEN', 'USDT'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'subscriptions_cost_currency_check') then
    alter table public.subscriptions
      add constraint subscriptions_cost_currency_check
      check (cost_currency in ('PEN', 'USDT'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'subscriptions_sale_price_rate_check') then
    alter table public.subscriptions
      add constraint subscriptions_sale_price_rate_check
      check (
        (sale_price_currency = 'PEN' and sale_price_exchange_rate is null)
        or (sale_price_currency = 'USDT' and sale_price_exchange_rate > 0)
      );
  end if;

  if not exists (select 1 from pg_constraint where conname = 'subscriptions_cost_rate_check') then
    alter table public.subscriptions
      add constraint subscriptions_cost_rate_check
      check (
        (cost_currency = 'PEN' and cost_exchange_rate is null)
        or (cost_currency = 'USDT' and cost_exchange_rate > 0)
      );
  end if;
end
$$;

-- No se modifica RLS, ni autenticación, ni políticas existentes.
