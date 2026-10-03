-- PRO VENTAS GC
-- Ejecuta este archivo UNA sola vez en Supabase > SQL Editor.
--
-- Si la tabla ya existe SIN soporte de moneda (instalación anterior), ejecuta
-- además supabase/migrations/2026-10-02-add-currency.sql, que añade las columnas
-- de moneda sin perder ningún registro existente.

create extension if not exists pgcrypto;

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),

  client_name text not null,
  phone text,
  service text not null,

  username_email text,
  password text,
  profile text,
  pin text,
  access_url text,

  sale_price numeric(10,2) not null default 0 check (sale_price >= 0),
  cost numeric(10,2) not null default 0 check (cost >= 0),
  -- Moneda original del importe: 'PEN' (predeterminado) o 'USDT'.
  -- El tipo de cambio (S/ por 1 USDT) se registra por operación y no cambia
  -- con las variaciones posteriores del mercado.
  sale_price_currency text not null default 'PEN' check (sale_price_currency in ('PEN', 'USDT')),
  cost_currency text not null default 'PEN' check (cost_currency in ('PEN', 'USDT')),
  sale_price_exchange_rate numeric(12,6),
  cost_exchange_rate numeric(12,6),
  check (
    (sale_price_currency = 'PEN' and sale_price_exchange_rate is null)
    or (sale_price_currency = 'USDT' and sale_price_exchange_rate is not null and sale_price_exchange_rate > 0)
  ),
  check (
    (cost_currency = 'PEN' and cost_exchange_rate is null)
    or (cost_currency = 'USDT' and cost_exchange_rate is not null and cost_exchange_rate > 0)
  ),
  provider text,

  start_date date default current_date,
  expiry_date date not null,
  provider_expiry_date date,

  extras jsonb not null default '{}'::jsonb,
  notes text,

  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_service_idx
  on public.subscriptions (service);

create index if not exists subscriptions_expiry_idx
  on public.subscriptions (expiry_date);

create index if not exists subscriptions_client_idx
  on public.subscriptions (client_name);

create index if not exists subscriptions_sale_price_currency_idx
  on public.subscriptions (sale_price_currency);

create index if not exists subscriptions_cost_currency_idx
  on public.subscriptions (cost_currency);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
before update on public.subscriptions
for each row execute function public.set_updated_at();

alter table public.subscriptions enable row level security;

-- Nadie sin sesión puede leer o modificar la tabla.
revoke all on table public.subscriptions from anon;

-- Solo dos usuarios autorizados pueden acceder a la tabla.
grant select, insert, update, delete on table public.subscriptions to authenticated;

-- IMPORTANTE: Reemplaza estos UUIDs con los IDs reales de tus dos cuentas.
-- Los encuentras en Supabase -> Authentication -> Users -> columna "User UID"
-- o con: select id, email from auth.users;
--
-- Si se ejecuta con los placeholders sin reemplazar, NADIE podrá acceder
-- (la app falla cerrada, no abierta).
--
-- Se eliminan los nombres de políticas anteriores para evitar que una
-- política permisiva vieja siga activa (PostgreSQL combina políticas con OR).
drop policy if exists "Authenticated users share subscriptions" on public.subscriptions;
drop policy if exists "Only authorized users access subscriptions" on public.subscriptions;
create policy "Only authorized users access subscriptions"
on public.subscriptions
for all
to authenticated
using (
  auth.uid() in (
    '3d8f71db-5e06-4859-92d6-acb57e90b74b'::uuid,
    '742a761c-983e-41ba-864f-9394514d98f5'::uuid
  )
)
with check (
  auth.uid() in (
    '3d8f71db-5e06-4859-92d6-acb57e90b74b'::uuid,
    '742a761c-983e-41ba-864f-9394514d98f5'::uuid
  )
);
