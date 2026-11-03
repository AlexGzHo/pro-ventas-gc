-- =============================================================================
-- PRO VENTAS GC — v8 Multi-revendedor (Spec 02)                    BORRADOR DE REFERENCIA
-- =============================================================================
-- ⚠️  NO APLICAR EN PRODUCCIÓN TAL CUAL.
-- Validado en una base local que reproduce setup.sql + migraciones v1–v7, con
-- supabase/tests/rls_multirevendedor.sql en verde. Antes de usarlo:
--   1. Comparar con el esquema REAL de producción (skill supabase-guardian, solo lectura).
--      La tabla products se creó a mano en el panel: verificar columnas, índices y políticas reales.
--   2. Confirmar la decisión D1 (rol de Liz) y ajustar la sección 1.
--   3. Copiar a supabase/migrations/<AAAAMMDDHHMMSS>_v8_multi_revendedor.sql, aplicar en STAGING
--      y ejecutar supabase/tests/rls_multirevendedor.sql.
--   4. Producción solo con autorización explícita del dueño y respaldo previo.
-- Todo el script es una transacción: si algo falla, no se aplica nada.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Perfiles, cuentas y roles
--    CUENTA = unidad dueña de los datos. Cada revendedor tiene la suya; Alex y Liz comparten
--    la cuenta de Alex (un solo negocio). owner_id en las tablas guarda la CUENTA, no la persona.
--    account_id apunta al perfil "titular" de la cuenta (el titular tiene account_id = id).
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  account_id   uuid not null,
  display_name text not null,
  role         text not null default 'reseller' check (role in ('admin', 'reseller')),
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);
alter table public.profiles drop constraint if exists profiles_account_id_fkey;
alter table public.profiles add constraint profiles_account_id_fkey
  foreign key (account_id) references public.profiles(id);

-- Perfiles para los usuarios que ya existen (cada uno titular de su cuenta, de momento).
insert into public.profiles (id, account_id, display_name, role)
select u.id, u.id, coalesce(nullif(split_part(u.email, '@', 1), ''), 'Usuario'), 'reseller'
from auth.users u
on conflict (id) do nothing;

-- D1: Alex es admin. Liz: admin y miembro de la cuenta de Alex (ve y opera todo, como hoy).
-- Si se decide que sea revendedora: quitar su UUID de la lista de admin y NO moverla a la cuenta de Alex.
update public.profiles set role = 'admin'
where id in ('3d8f71db-5e06-4859-92d6-acb57e90b74b', '742a761c-983e-41ba-864f-9394514d98f5');
update public.profiles set account_id = '3d8f71db-5e06-4859-92d6-acb57e90b74b'
where id = '742a761c-983e-41ba-864f-9394514d98f5';

update public.profiles set display_name = 'Alex' where id = '3d8f71db-5e06-4859-92d6-acb57e90b74b';
update public.profiles set display_name = 'Liz'  where id = '742a761c-983e-41ba-864f-9394514d98f5';

-- Todo usuario nuevo de Auth nace como revendedor activo y titular de su propia cuenta.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, account_id, display_name)
  values (new.id, new.id, coalesce(nullif(split_part(new.email, '@', 1), ''), 'Usuario'))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 2. Funciones auxiliares de autorización
--    SECURITY DEFINER para leer profiles sin depender de su RLS (evita recursión).
-- -----------------------------------------------------------------------------
create or replace function public.is_active_user()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and is_active);
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and is_active and role = 'admin');
$$;

-- Cuenta del usuario actual (null si no tiene perfil o está desactivado).
create or replace function public.current_account()
returns uuid language sql stable security definer set search_path = '' as $$
  select account_id from public.profiles where id = (select auth.uid()) and is_active;
$$;

create or replace function public.can_access(p_owner uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_owner is not null and exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and is_active and (role = 'admin' or account_id = p_owner)
  );
$$;

-- ¿Es p_owner una cuenta activa válida (perfil titular)?
create or replace function public.is_valid_account(p_owner uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = p_owner and account_id = id and is_active);
$$;

-- -----------------------------------------------------------------------------
-- 3. Columna owner_id + backfill
-- -----------------------------------------------------------------------------
alter table public.clients               add column if not exists owner_id uuid;
alter table public.products              add column if not exists owner_id uuid;
alter table public.providers             add column if not exists owner_id uuid;
alter table public.subscriptions         add column if not exists owner_id uuid;
alter table public.subscription_renewals add column if not exists owner_id uuid;
alter table public.whatsapp_templates    add column if not exists owner_id uuid;

-- Hoy Alex y Liz comparten UN catálogo, clientes y proveedores. Repartir por created_by
-- mezclaría dueños dentro de una misma venta (p. ej. venta de Liz con producto de Alex) y
-- bloquearía editarla después. Por eso TODO lo existente pasa a un único dueño: Alex.
-- created_by se conserva intacto como dato histórico de quién lo registró.
-- (Si D1 decide que Liz sea revendedora, sus datos se separan en una migración aparte,
--  copiando también el catálogo/proveedores que usen sus ventas.)
update public.clients               set owner_id = '3d8f71db-5e06-4859-92d6-acb57e90b74b' where owner_id is null;
update public.products              set owner_id = '3d8f71db-5e06-4859-92d6-acb57e90b74b' where owner_id is null;
update public.providers             set owner_id = '3d8f71db-5e06-4859-92d6-acb57e90b74b' where owner_id is null;
update public.subscriptions         set owner_id = '3d8f71db-5e06-4859-92d6-acb57e90b74b' where owner_id is null;
update public.whatsapp_templates    set owner_id = '3d8f71db-5e06-4859-92d6-acb57e90b74b' where owner_id is null;
update public.subscription_renewals r set owner_id = s.owner_id
from public.subscriptions s where s.id = r.subscription_id and r.owner_id is null;

do $$
declare t text;
begin
  foreach t in array array['clients','products','providers','subscriptions','subscription_renewals','whatsapp_templates'] loop
    execute format('alter table public.%I alter column owner_id set default public.current_account()', t);
    execute format('alter table public.%I alter column owner_id set not null', t);
    execute format('alter table public.%I drop constraint if exists %I', t, t || '_owner_id_fkey');
    execute format('alter table public.%I add constraint %I foreign key (owner_id) references public.profiles(id)', t, t || '_owner_id_fkey');
    execute format('create index if not exists %I on public.%I (owner_id)', t || '_owner_id_idx', t);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- 4. Unicidad por dueño
-- -----------------------------------------------------------------------------
drop index if exists public.products_name_unique_idx;
create unique index products_owner_name_unique_idx on public.products (owner_id, upper(trim(name)));

alter table public.whatsapp_templates drop constraint if exists whatsapp_templates_pkey;
alter table public.whatsapp_templates add constraint whatsapp_templates_pkey primary key (owner_id, id);

-- -----------------------------------------------------------------------------
-- 5. Integridad entre dueños (triggers)
-- -----------------------------------------------------------------------------
-- owner_id no se puede cambiar: reasignar datos entre dueños queda fuera de alcance.
create or replace function public.prevent_owner_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.owner_id is distinct from old.owner_id then
    raise exception 'owner_id no se puede modificar' using errcode = '42501';
  end if;
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['clients','products','providers','subscriptions','subscription_renewals','whatsapp_templates'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_owner_immutable', t);
    execute format('create trigger %I before update of owner_id on public.%I for each row execute function public.prevent_owner_change()', t || '_owner_immutable', t);
  end loop;
end $$;

-- Una venta solo puede usar cliente, producto y proveedor de su mismo dueño.
create or replace function public.check_subscription_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.client_id is not null and not exists (
       select 1 from public.clients where id = new.client_id and owner_id = new.owner_id) then
    raise exception 'El cliente no pertenece al mismo dueño de la venta' using errcode = '42501';
  end if;
  if new.product_id is not null and not exists (
       select 1 from public.products where id = new.product_id and owner_id = new.owner_id) then
    raise exception 'El producto no pertenece al mismo dueño de la venta' using errcode = '42501';
  end if;
  if new.provider_id is not null and not exists (
       select 1 from public.providers where id = new.provider_id and owner_id = new.owner_id) then
    raise exception 'El proveedor no pertenece al mismo dueño de la venta' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists subscriptions_owner_integrity on public.subscriptions;
create trigger subscriptions_owner_integrity
  before insert or update of client_id, product_id, provider_id, owner_id on public.subscriptions
  for each row execute function public.check_subscription_owner();

create or replace function public.check_product_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.provider_id is not null and not exists (
       select 1 from public.providers where id = new.provider_id and owner_id = new.owner_id) then
    raise exception 'El proveedor no pertenece al mismo dueño del producto' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists products_owner_integrity on public.products;
create trigger products_owner_integrity
  before insert or update of provider_id, owner_id on public.products
  for each row execute function public.check_product_owner();

-- Una renovación siempre hereda el dueño de su venta (nunca lo decide quien llama).
create or replace function public.set_renewal_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  select owner_id into new.owner_id from public.subscriptions where id = new.subscription_id;
  if new.owner_id is null then
    raise exception 'Venta inexistente para la renovación';
  end if;
  return new;
end;
$$;

drop trigger if exists subscription_renewals_set_owner on public.subscription_renewals;
create trigger subscription_renewals_set_owner
  before insert on public.subscription_renewals
  for each row execute function public.set_renewal_owner();

-- Comprobación de los datos existentes: si algo quedó con dueños mezclados, se aborta TODO.
do $$
declare n int;
begin
  select count(*) into n from public.subscriptions s
  where exists (select 1 from public.clients c   where c.id = s.client_id   and c.owner_id <> s.owner_id)
     or exists (select 1 from public.products p  where p.id = s.product_id  and p.owner_id <> s.owner_id)
     or exists (select 1 from public.providers v where v.id = s.provider_id and v.owner_id <> s.owner_id);
  if n > 0 then raise exception 'v8 abortada: % ventas con cliente/producto/proveedor de otro dueño', n; end if;

  select count(*) into n from public.products p
  where exists (select 1 from public.providers v where v.id = p.provider_id and v.owner_id <> p.owner_id);
  if n > 0 then raise exception 'v8 abortada: % productos con proveedor de otro dueño', n; end if;

  select count(*) into n from public.subscription_renewals r
  join public.subscriptions s on s.id = r.subscription_id where r.owner_id <> s.owner_id;
  if n > 0 then raise exception 'v8 abortada: % renovaciones con dueño distinto al de su venta', n; end if;
end $$;

-- -----------------------------------------------------------------------------
-- 6. Políticas RLS: se borran TODAS las existentes (con UUID fijos) y se crean las nuevas
-- -----------------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select tablename, policyname from pg_policies
    where schemaname = 'public'
      and tablename in ('clients','products','providers','subscriptions','subscription_renewals','whatsapp_templates','profiles')
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

alter table public.profiles enable row level security;

-- Regla común. (select ...) hace que PostgreSQL evalúe las funciones una vez por consulta, no por fila.
do $$
declare
  t text;
  -- current_account() es null para usuarios inactivos, así que la comparación ya los excluye.
  rule text := '((select public.is_admin()) or owner_id = (select public.current_account()))';
begin
  foreach t in array array['clients','products','providers','subscriptions','whatsapp_templates'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using %s', t || '_select', t, rule);
    execute format('create policy %I on public.%I for insert to authenticated with check %s', t || '_insert', t, rule);
    execute format('create policy %I on public.%I for update to authenticated using %s with check %s', t || '_update', t, rule, rule);
    execute format('create policy %I on public.%I for delete to authenticated using %s', t || '_delete', t, rule);
  end loop;

  -- Renovaciones: solo lectura por REST; se escriben únicamente vía RPC.
  execute format('create policy subscription_renewals_select on public.subscription_renewals for select to authenticated using %s', rule);
end $$;

create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));
create policy profiles_update_admin on public.profiles for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- -----------------------------------------------------------------------------
-- 7. Permisos: anon fuera; authenticated con lo justo (RLS decide qué filas)
-- -----------------------------------------------------------------------------
revoke all on public.clients, public.products, public.providers, public.subscriptions,
              public.subscription_renewals, public.whatsapp_templates, public.profiles from anon;
grant select, insert, update, delete on public.clients, public.products, public.providers,
              public.subscriptions, public.whatsapp_templates to authenticated;
grant select on public.subscription_renewals to authenticated;
revoke insert, update, delete on public.subscription_renewals from authenticated;
grant select, update on public.profiles to authenticated;
revoke insert, delete on public.profiles from authenticated;

-- -----------------------------------------------------------------------------
-- 8. RPC reescritas (misma lógica de negocio + controles de dueño al inicio)
-- -----------------------------------------------------------------------------

-- La versión legada usa columnas de texto y no conoce dueños: el frontend ya no la usa. Se elimina.
drop function if exists public.create_subscription(text, text, text, text, text, text, text, text, numeric, numeric,
  text, text, numeric, numeric, text, date, date, date, jsonb, text, uuid);

-- Cambia la firma (nuevo p_owner_id): se borra la anterior para no dejar una sobrecarga sin controles.
drop function if exists public.create_subscription_v3(uuid, uuid, uuid, text, text, text, text, text, numeric, numeric,
  text, text, numeric, numeric, date, date, date, jsonb, text, uuid);

create function public.create_subscription_v3(
  p_client_id uuid, p_product_id uuid, p_provider_id uuid, p_username_email text, p_password text, p_profile text,
  p_pin text, p_access_url text, p_sale_price numeric, p_cost numeric, p_sale_currency text, p_cost_currency text,
  p_sale_exchange_rate numeric, p_cost_exchange_rate numeric, p_start_date date, p_expiry_date date,
  p_provider_expiry_date date, p_extras jsonb, p_notes text, p_idempotency_key uuid,
  p_owner_id uuid default null
)
returns table(subscription_id uuid, renewal_id uuid)
language plpgsql security definer set search_path = public, pg_temp
as $function$
declare
    v_owner uuid;
    v_sub_id uuid;
    v_ren_id uuid;
    v_client_name text;
    v_phone text;
    v_service text;
    v_provider text;
    v_period_value int;
    v_period_unit varchar(10);
begin
    -- Autorización: usuario activo; solo el admin registra a nombre de otro dueño.
    if auth.uid() is null or not public.is_active_user() then
        raise exception 'Unauthorized';
    end if;
    v_owner := coalesce(p_owner_id, public.current_account());
    if v_owner is distinct from public.current_account() and not public.is_admin() then
        raise exception 'Unauthorized';
    end if;
    if not public.is_valid_account(v_owner) then
        raise exception 'Owner % is not an active account', v_owner;
    end if;

    -- Existencia + pertenencia al dueño (mismo mensaje si es ajeno: no revela que existe).
    if p_client_id is null then
        raise exception 'p_client_id is required';
    elsif not exists (select 1 from public.clients where id = p_client_id and owner_id = v_owner) then
        raise exception 'Client % does not exist', p_client_id;
    end if;

    if p_product_id is null then
        raise exception 'p_product_id is required';
    elsif not exists (select 1 from public.products where id = p_product_id and owner_id = v_owner) then
        raise exception 'Product % does not exist', p_product_id;
    end if;

    if p_provider_id is not null and not exists (select 1 from public.providers where id = p_provider_id and owner_id = v_owner) then
        raise exception 'Provider % does not exist', p_provider_id;
    end if;

    if p_idempotency_key is null then
        raise exception 'p_idempotency_key is required';
    end if;

    -- Calcular periodo sin inventar si no cuadra exacto (lógica v3 sin cambios)
    v_period_value := null;
    v_period_unit := null;
    if p_start_date is not null and p_expiry_date is not null then
        if p_expiry_date = p_start_date + interval '7 days' then
            v_period_value := 7; v_period_unit := 'day';
        elsif p_expiry_date = p_start_date + interval '15 days' then
            v_period_value := 15; v_period_unit := 'day';
        elsif p_expiry_date = p_start_date + interval '1 month' then
            v_period_value := 1; v_period_unit := 'month';
        elsif p_expiry_date = p_start_date + interval '3 months' then
            v_period_value := 3; v_period_unit := 'month';
        elsif p_expiry_date = p_start_date + interval '6 months' then
            v_period_value := 6; v_period_unit := 'month';
        elsif p_expiry_date = p_start_date + interval '12 months' then
            v_period_value := 12; v_period_unit := 'month';
        end if;
    end if;

    select name, phone into v_client_name, v_phone from public.clients where id = p_client_id;
    select name into v_service from public.products where id = p_product_id;
    if p_provider_id is not null then
        select name into v_provider from public.providers where id = p_provider_id;
    end if;

    begin
        insert into public.subscriptions (
            client_id, product_id, provider_id, username_email, password, profile, pin, access_url,
            sale_price, cost, sale_price_currency, cost_currency, sale_price_exchange_rate, cost_exchange_rate,
            start_date, expiry_date, provider_expiry_date, extras, notes, created_by, owner_id,
            client_name, phone, service, provider
        ) values (
            p_client_id, p_product_id, p_provider_id, p_username_email, p_password, p_profile, p_pin, p_access_url,
            p_sale_price, p_cost, p_sale_currency, p_cost_currency, p_sale_exchange_rate, p_cost_exchange_rate,
            p_start_date, p_expiry_date, p_provider_expiry_date, p_extras, p_notes, auth.uid(), v_owner,
            v_client_name, v_phone, v_service, v_provider
        ) returning id into v_sub_id;

        -- owner_id de la renovación lo fija el trigger set_renewal_owner.
        insert into public.subscription_renewals (
            subscription_id, idempotency_key, type, previous_expiry_date, new_expiry_date,
            period_value, period_unit, sale_price, sale_currency, sale_exchange_rate,
            cost, cost_currency, cost_exchange_rate, renewed_by
        ) values (
            v_sub_id, p_idempotency_key, 'initial', null, p_expiry_date,
            v_period_value, v_period_unit, p_sale_price, p_sale_currency, p_sale_exchange_rate,
            p_cost, p_cost_currency, p_cost_exchange_rate, auth.uid()
        ) returning id into v_ren_id;

        return query select v_sub_id, v_ren_id;
    exception when unique_violation then
        -- Reintento con la misma idempotency_key: solo se devuelve si pertenece al MISMO dueño
        -- (si no, una clave ajena revelaría IDs de ventas de otro revendedor).
        select r.id, r.subscription_id into v_ren_id, v_sub_id
        from public.subscription_renewals r
        where r.idempotency_key = p_idempotency_key and r.owner_id = v_owner;

        if found then
            return query select v_sub_id, v_ren_id;
        else
            raise;
        end if;
    end;
end;
$function$;

create or replace function public.process_renewal(
  p_subscription_id uuid, p_period_value integer, p_period_unit character varying,
  p_idempotency_key uuid, p_start_date date default null::date
)
returns table(renewal_id uuid, subscription_id uuid, previous_expiry_date date, new_expiry_date date,
              sale_amount_pen numeric, cost_amount_pen numeric)
language plpgsql security definer set search_path = public, pg_temp
as $function$
declare
    v_sub record;
    v_renewal record;
    v_base_date date;
    v_new_expiry_date date;
    v_unit varchar;
    v_today_lima date;
    v_owner uuid;
begin
    -- 1. Autorización: usuario activo y con acceso a ESTA venta, antes de responder nada.
    if auth.uid() is null or not public.is_active_user() then
        raise exception 'Unauthorized';
    end if;
    if p_subscription_id is null then
        raise exception 'Subscription ID is required';
    end if;
    select s.owner_id into v_owner from public.subscriptions s where s.id = p_subscription_id;
    if not found or not public.can_access(v_owner) then
        raise exception 'Subscription not found';
    end if;

    -- 2. Validar parámetros obligatorios y rangos (sin cambios)
    if p_idempotency_key is null then
        raise exception 'Idempotency key is required';
    end if;
    if p_period_value is null or p_period_value <= 0 then
        raise exception 'Period value must be greater than 0';
    end if;
    if p_period_value > 1200 then
        raise exception 'Period value exceeds allowed limit';
    end if;
    v_unit := lower(trim(p_period_unit));
    if v_unit not in ('day', 'days', 'month', 'months') then
        raise exception 'Invalid period unit: %', p_period_unit;
    end if;
    if p_start_date is not null then
        if p_start_date < '2020-01-01'::date or p_start_date > ((current_timestamp at time zone 'America/Lima')::date + interval '10 years')::date then
            raise exception 'Invalid start date: %', p_start_date;
        end if;
    end if;

    -- 3. Verificar existencia idempotente temprana
    select * into v_renewal from public.subscription_renewals r where r.idempotency_key = p_idempotency_key;
    if found then
        if v_renewal.subscription_id != p_subscription_id then
            raise exception 'Idempotency key already used for a different subscription';
        end if;
        return query select v_renewal.id, v_renewal.subscription_id, v_renewal.previous_expiry_date, v_renewal.new_expiry_date, v_renewal.sale_amount_pen, v_renewal.cost_amount_pen;
        return;
    end if;

    -- 4. Bloquear suscripción
    select * into v_sub from public.subscriptions s where s.id = p_subscription_id for update;
    if not found then
        raise exception 'Subscription not found';
    end if;
    if v_sub.archived_at is not null then
        raise exception 'Cannot renew an archived subscription';
    end if;

    -- 5. Re-verificar idempotencia tras adquirir bloqueo
    select * into v_renewal from public.subscription_renewals r where r.idempotency_key = p_idempotency_key;
    if found then
        if v_renewal.subscription_id != p_subscription_id then
            raise exception 'Idempotency key already used for a different subscription';
        end if;
        return query select v_renewal.id, v_renewal.subscription_id, v_renewal.previous_expiry_date, v_renewal.new_expiry_date, v_renewal.sale_amount_pen, v_renewal.cost_amount_pen;
        return;
    end if;

    -- 6. Calcular fechas considerando zona horaria de Perú (America/Lima)
    v_today_lima := (current_timestamp at time zone 'America/Lima')::date;
    if p_start_date is not null then
        v_base_date := p_start_date;
    else
        if v_sub.expiry_date < v_today_lima then
            v_base_date := v_today_lima;
        else
            v_base_date := v_sub.expiry_date;
        end if;
    end if;
    v_new_expiry_date := (v_base_date + (p_period_value::text || ' ' || v_unit)::interval)::date;

    -- 7. Insertar renovación (owner_id lo fija el trigger) y 8. actualizar la venta
    begin
        insert into public.subscription_renewals (
            subscription_id, idempotency_key, type, start_date, previous_expiry_date, new_expiry_date,
            period_value, period_unit, sale_price, sale_currency, sale_exchange_rate,
            cost, cost_currency, cost_exchange_rate, renewed_by
        ) values (
            p_subscription_id, p_idempotency_key, 'renewal', v_base_date, v_sub.expiry_date, v_new_expiry_date,
            p_period_value, v_unit, v_sub.sale_price, v_sub.sale_price_currency, v_sub.sale_price_exchange_rate,
            v_sub.cost, v_sub.cost_currency, v_sub.cost_exchange_rate, auth.uid()
        ) returning * into v_renewal;

        update public.subscriptions s set expiry_date = v_new_expiry_date where s.id = p_subscription_id;
    exception when unique_violation then
        select * into v_renewal from public.subscription_renewals r where r.idempotency_key = p_idempotency_key;
        if not found or v_renewal.subscription_id != p_subscription_id then
            raise exception 'Idempotency key already used for a different subscription';
        end if;
    end;

    -- 9. Retornar contrato original
    return query select v_renewal.id, v_renewal.subscription_id, v_renewal.previous_expiry_date, v_renewal.new_expiry_date, v_renewal.sale_amount_pen, v_renewal.cost_amount_pen;
end;
$function$;

create or replace function public.delete_subscription_transactional(p_sub_id uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
    v_owner uuid;
begin
    if auth.uid() is null or not public.is_active_user() then
        raise exception 'No autorizado para eliminar suscripciones.';
    end if;

    select owner_id into v_owner from public.subscriptions where id = p_sub_id for update;
    if not found or not public.can_access(v_owner) then
        raise exception 'La suscripción especificada no existe.';
    end if;

    delete from public.subscription_renewals where subscription_id = p_sub_id;
    delete from public.subscriptions where id = p_sub_id;
    if not found then
        raise exception 'No se pudo eliminar la suscripción.';
    end if;
end;
$function$;

create or replace function public.delete_client(p_client_id uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
    v_owner uuid;
    v_rows int;
begin
    if auth.uid() is null or not public.is_active_user() then
        raise exception 'Unauthorized';
    end if;

    select owner_id into v_owner from public.clients where id = p_client_id for update;
    if not found or not public.can_access(v_owner) then
        raise exception 'Client not found or already deleted';
    end if;

    if exists (select 1 from public.subscriptions where client_id = p_client_id) then
        raise exception 'Cannot delete client with active or historical subscriptions';
    end if;

    delete from public.clients where id = p_client_id;
    get diagnostics v_rows = row_count;
    if v_rows <> 1 then
        raise exception 'Failed to delete exact client record';
    end if;
end;
$function$;

create or replace function public.merge_clients(p_target_client_id uuid, p_source_client_id uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
    v_rows int;
    v_target_owner uuid;
    v_source_owner uuid;
begin
    if auth.uid() is null or not public.is_active_user() then
        raise exception 'Unauthorized';
    end if;
    if p_target_client_id = p_source_client_id then
        raise exception 'Target and source clients must be different';
    end if;

    -- Bloqueo determinista (sin cambios)
    if p_target_client_id < p_source_client_id then
        perform 1 from public.clients where id = p_target_client_id for update;
        perform 1 from public.clients where id = p_source_client_id for update;
    else
        perform 1 from public.clients where id = p_source_client_id for update;
        perform 1 from public.clients where id = p_target_client_id for update;
    end if;

    select owner_id into v_target_owner from public.clients where id = p_target_client_id;
    if not found or not public.can_access(v_target_owner) then
        raise exception 'Target client not found';
    end if;
    select owner_id into v_source_owner from public.clients where id = p_source_client_id;
    if not found or not public.can_access(v_source_owner) then
        raise exception 'Source client not found';
    end if;
    if v_target_owner <> v_source_owner then
        raise exception 'Clients belong to different owners';
    end if;

    update public.subscriptions set client_id = p_target_client_id where client_id = p_source_client_id;

    delete from public.clients where id = p_source_client_id;
    get diagnostics v_rows = row_count;
    if v_rows <> 1 then
        raise exception 'Failed to delete exact source client record';
    end if;
end;
$function$;

create or replace function public.delete_provider(p_provider_id uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
    v_owner uuid;
    v_rows int;
begin
    if auth.uid() is null or not public.is_active_user() then
        raise exception 'Unauthorized';
    end if;

    select owner_id into v_owner from public.providers where id = p_provider_id for update;
    if not found or not public.can_access(v_owner) then
        raise exception 'Provider not found or already deleted';
    end if;

    if exists (select 1 from public.subscriptions where provider_id = p_provider_id) then
        raise exception 'Cannot delete provider with associated subscriptions';
    end if;
    if exists (select 1 from public.products where provider_id = p_provider_id) then
        raise exception 'Cannot delete provider with associated products';
    end if;

    delete from public.providers where id = p_provider_id;
    get diagnostics v_rows = row_count;
    if v_rows <> 1 then
        raise exception 'Failed to delete exact provider record';
    end if;
end;
$function$;

create or replace function public.merge_providers(p_target_provider_id uuid, p_source_provider_id uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
    v_rows int;
    v_target_owner uuid;
    v_source_owner uuid;
begin
    if auth.uid() is null or not public.is_active_user() then
        raise exception 'Unauthorized';
    end if;
    if p_target_provider_id = p_source_provider_id then
        raise exception 'Target and source providers must be different';
    end if;

    if p_target_provider_id < p_source_provider_id then
        perform 1 from public.providers where id = p_target_provider_id for update;
        perform 1 from public.providers where id = p_source_provider_id for update;
    else
        perform 1 from public.providers where id = p_source_provider_id for update;
        perform 1 from public.providers where id = p_target_provider_id for update;
    end if;

    select owner_id into v_target_owner from public.providers where id = p_target_provider_id;
    if not found or not public.can_access(v_target_owner) then
        raise exception 'Target provider not found';
    end if;
    select owner_id into v_source_owner from public.providers where id = p_source_provider_id;
    if not found or not public.can_access(v_source_owner) then
        raise exception 'Source provider not found';
    end if;
    if v_target_owner <> v_source_owner then
        raise exception 'Providers belong to different owners';
    end if;

    update public.products set provider_id = p_target_provider_id where provider_id = p_source_provider_id;
    update public.subscriptions set provider_id = p_target_provider_id where provider_id = p_source_provider_id;

    delete from public.providers where id = p_source_provider_id;
    get diagnostics v_rows = row_count;
    if v_rows <> 1 then
        raise exception 'Failed to delete exact source provider record';
    end if;
end;
$function$;

-- Ejecutables solo por usuarios autenticados (cada función valida dueño por dentro).
do $$
declare f text;
begin
  foreach f in array array[
    'public.create_subscription_v3(uuid, uuid, uuid, text, text, text, text, text, numeric, numeric, text, text, numeric, numeric, date, date, date, jsonb, text, uuid, uuid)',
    'public.process_renewal(uuid, integer, character varying, uuid, date)',
    'public.delete_subscription_transactional(uuid)',
    'public.delete_client(uuid)', 'public.merge_clients(uuid, uuid)',
    'public.delete_provider(uuid)', 'public.merge_providers(uuid, uuid)',
    'public.is_admin()', 'public.is_active_user()', 'public.can_access(uuid)',
    'public.current_account()', 'public.is_valid_account(uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- Funciones de triggers: nadie las llama directamente.
revoke execute on function public.handle_new_user(), public.prevent_owner_change(), public.check_subscription_owner(),
  public.check_product_owner(), public.set_renewal_owner() from public, anon, authenticated;

commit;
