-- products tal como existía en Supabase antes de la v3 (creada a mano en el panel; reconstruida desde supabase/schemas).
create table public.products (
  id uuid not null default gen_random_uuid() primary key,
  name text not null, sale_price numeric(10,2) not null, currency text not null default 'PEN',
  active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint products_currency_allowed check (currency = any (array['PEN','USDT'])),
  constraint products_name_not_empty check (length(trim(name)) > 0),
  constraint products_sale_price_positive check (sale_price > 0)
);
alter table public.products enable row level security;
create unique index products_name_unique_idx on public.products (upper(trim(name)));
create policy "Access authorized" on public.products for all to authenticated
  using (auth.uid() = any (array['3d8f71db-5e06-4859-92d6-acb57e90b74b'::uuid, '742a761c-983e-41ba-864f-9394514d98f5'::uuid]))
  with check (auth.uid() = any (array['3d8f71db-5e06-4859-92d6-acb57e90b74b'::uuid, '742a761c-983e-41ba-864f-9394514d98f5'::uuid]));
create policy "Authorized users can read products" on public.products for select to authenticated
  using ((select auth.uid()) = any (array['3d8f71db-5e06-4859-92d6-acb57e90b74b'::uuid, '742a761c-983e-41ba-864f-9394514d98f5'::uuid]));
-- Grants tal como aparecen en el volcado (anon incluido: lo bloquea solo RLS).
grant select, insert, update, delete on public.products to anon, authenticated;
