-- =============================================================================
-- PRO VENTAS GC — Pruebas de aislamiento multi-revendedor (Spec 02, sección 7)
-- =============================================================================
-- ⚠️  SOLO EN EL PROYECTO DE PRUEBAS (STAGING). NUNCA EN PRODUCCIÓN.
-- Requiere que la migración v8 (profiles, owner_id, políticas y RPCs nuevas) ya esté aplicada.
-- Ejecutar completo como `postgres` en el SQL Editor de staging.
-- Todo ocurre dentro de una transacción que termina en ROLLBACK: no deja datos.
-- Si una prueba falla, el script se detiene con "FALLO <n>: <motivo>".
-- Si llega al final, muestra "TODAS LAS PRUEBAS PASARON".
--
-- Si alguna columna NOT NULL nueva del esquema real no aparece en la preparación,
-- agrégala aquí; NO debilites ninguna aserción para que el script pase.
-- =============================================================================

begin;

-- ---------------------------------------------------------------- Preparación
-- Usuarios de prueba: A = admin, R2 y R3 = revendedores, R4 = revendedor inactivo.
insert into auth.users (id, email, aud, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'admin.test@example.com', 'authenticated', 'authenticated'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'r2.test@example.com',    'authenticated', 'authenticated'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'r3.test@example.com',    'authenticated', 'authenticated'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'r4.test@example.com',    'authenticated', 'authenticated');

-- El trigger debe haber creado los perfiles como revendedores.
do $$ begin
  if (select count(*) from public.profiles where id::text like 'aaaaaaaa-%' and role = 'reseller') <> 4 then
    raise exception 'FALLO 0: el trigger de auth.users no creó los 4 perfiles como reseller';
  end if;
end $$;

update public.profiles set role = 'admin'   where id = 'aaaaaaaa-0000-0000-0000-000000000001';
update public.profiles set is_active = false where id = 'aaaaaaaa-0000-0000-0000-000000000004';

-- Un cliente, proveedor, producto y venta por usuario (insertados como postgres, con owner_id explícito).
insert into public.providers (id, name, owner_id)
select ('bbbbbbbb-0000-0000-0000-00000000000' || n)::uuid, 'Proveedor ' || n, ('aaaaaaaa-0000-0000-0000-00000000000' || n)::uuid
from generate_series(1, 4) n;

insert into public.clients (id, name, phone, owner_id)
select ('cccccccc-0000-0000-0000-00000000000' || n)::uuid, 'Cliente ' || n, '90000000' || n, ('aaaaaaaa-0000-0000-0000-00000000000' || n)::uuid
from generate_series(1, 4) n;

insert into public.products (id, name, sale_price, provider_id, owner_id)
select ('dddddddd-0000-0000-0000-00000000000' || n)::uuid, 'Netflix', 15, ('bbbbbbbb-0000-0000-0000-00000000000' || n)::uuid,
       ('aaaaaaaa-0000-0000-0000-00000000000' || n)::uuid
from generate_series(1, 4) n;  -- mismo nombre "Netflix" para todos: prueba la unicidad por dueño

insert into public.subscriptions (id, client_id, product_id, provider_id, client_name, service, expiry_date, owner_id, created_by)
select ('eeeeeeee-0000-0000-0000-00000000000' || n)::uuid,
       ('cccccccc-0000-0000-0000-00000000000' || n)::uuid,
       ('dddddddd-0000-0000-0000-00000000000' || n)::uuid,
       ('bbbbbbbb-0000-0000-0000-00000000000' || n)::uuid,
       'Cliente ' || n, 'Netflix', current_date + 10,
       ('aaaaaaaa-0000-0000-0000-00000000000' || n)::uuid,
       ('aaaaaaaa-0000-0000-0000-00000000000' || n)::uuid
from generate_series(1, 4) n;

-- ------------------------------------------------------------- Revendedor R2
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;

-- 1. Solo ve filas propias en cada tabla.
do $$
declare t text; n int;
begin
  foreach t in array array['clients','products','providers','subscriptions','subscription_renewals','whatsapp_templates'] loop
    execute format('select count(*) from public.%I where owner_id <> %L', t, 'aaaaaaaa-0000-0000-0000-000000000002') into n;
    if n > 0 then raise exception 'FALLO 1: R2 ve % filas ajenas en %', n, t; end if;
  end loop;
  if (select count(*) from public.clients) <> 1 then raise exception 'FALLO 1: R2 debería ver exactamente 1 cliente'; end if;
end $$;

-- 2. No encuentra por ID filas de R3 ni de A.
do $$ begin
  if exists (select 1 from public.subscriptions where id in ('eeeeeeee-0000-0000-0000-000000000003','eeeeeeee-0000-0000-0000-000000000001')) then
    raise exception 'FALLO 2: R2 puede leer ventas de R3 o del admin';
  end if;
  if exists (select 1 from public.profiles where id <> 'aaaaaaaa-0000-0000-0000-000000000002') then
    raise exception 'FALLO 2: R2 puede ver perfiles ajenos';
  end if;
end $$;

-- 3. No puede insertar con owner_id ajeno.
do $$ declare ok boolean := false; begin
  begin insert into public.clients (name, owner_id) values ('Intruso', 'aaaaaaaa-0000-0000-0000-000000000003');
  exception when others then ok := true; end;
  if not ok then raise exception 'FALLO 3: R2 insertó un cliente a nombre de R3'; end if;
end $$;

-- 4. No puede "regalar" su fila a otro dueño.
do $$ declare ok boolean := false; begin
  begin update public.clients set owner_id = 'aaaaaaaa-0000-0000-0000-000000000003' where id = 'cccccccc-0000-0000-0000-000000000002';
        if not found then ok := true; end if;
  exception when others then ok := true; end;
  if not ok then raise exception 'FALLO 4: R2 cambió el owner_id de su cliente a R3'; end if;
end $$;

-- 5. No puede crear una venta con el cliente de R3.
do $$ declare ok boolean := false; begin
  begin perform public.create_subscription_v3(
      p_client_id => 'cccccccc-0000-0000-0000-000000000003', p_product_id => 'dddddddd-0000-0000-0000-000000000002',
      p_provider_id => null, p_username_email => null, p_password => null, p_profile => null, p_pin => null,
      p_access_url => null, p_sale_price => 10, p_cost => 5, p_sale_currency => 'PEN', p_cost_currency => 'PEN',
      p_sale_exchange_rate => null, p_cost_exchange_rate => null, p_start_date => current_date,
      p_expiry_date => current_date + 30, p_provider_expiry_date => null, p_extras => '{}'::jsonb, p_notes => null,
      p_idempotency_key => gen_random_uuid());
  exception when others then ok := true; end;
  if not ok then raise exception 'FALLO 5: R2 creó una venta usando el cliente de R3'; end if;
end $$;

-- 6. No puede crear una venta a nombre de R3 (p_owner_id solo para admin).
do $$ declare ok boolean := false; begin
  begin perform public.create_subscription_v3(
      p_client_id => 'cccccccc-0000-0000-0000-000000000002', p_product_id => 'dddddddd-0000-0000-0000-000000000002',
      p_provider_id => null, p_username_email => null, p_password => null, p_profile => null, p_pin => null,
      p_access_url => null, p_sale_price => 10, p_cost => 5, p_sale_currency => 'PEN', p_cost_currency => 'PEN',
      p_sale_exchange_rate => null, p_cost_exchange_rate => null, p_start_date => current_date,
      p_expiry_date => current_date + 30, p_provider_expiry_date => null, p_extras => '{}'::jsonb, p_notes => null,
      p_idempotency_key => gen_random_uuid(), p_owner_id => 'aaaaaaaa-0000-0000-0000-000000000003');
  exception when others then ok := true; end;
  if not ok then raise exception 'FALLO 6: R2 creó una venta a nombre de R3'; end if;
end $$;

-- 7. No puede renovar ni borrar la venta de R3.
do $$ declare ok boolean := false; begin
  begin perform public.process_renewal(p_subscription_id => 'eeeeeeee-0000-0000-0000-000000000003',
        p_period_value => 1, p_period_unit => 'month', p_idempotency_key => gen_random_uuid());
  exception when others then ok := true; end;
  if not ok then raise exception 'FALLO 7a: R2 renovó la venta de R3'; end if;
end $$;
do $$ declare ok boolean := false; begin
  begin perform public.delete_subscription_transactional('eeeeeeee-0000-0000-0000-000000000003');
  exception when others then ok := true; end;
  if not ok then raise exception 'FALLO 7b: R2 borró la venta de R3'; end if;
end $$;

-- 8. No puede fusionar su cliente con uno de R3.
do $$ declare ok boolean := false; begin
  begin perform public.merge_clients(p_target_client_id => 'cccccccc-0000-0000-0000-000000000002',
                                     p_source_client_id => 'cccccccc-0000-0000-0000-000000000003');
  exception when others then ok := true; end;
  if not ok then raise exception 'FALLO 8: R2 fusionó un cliente de R3'; end if;
end $$;

-- 9. No puede ascenderse a admin.
do $$ begin
  begin update public.profiles set role = 'admin' where id = 'aaaaaaaa-0000-0000-0000-000000000002';
  exception when others then null; end;
end $$;
reset role;
do $$ begin
  if (select role from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000002') <> 'reseller' then
    raise exception 'FALLO 9: R2 cambió su propio rol a admin';
  end if;
  if (select count(*) from public.subscriptions where id = 'eeeeeeee-0000-0000-0000-000000000003') <> 1 then
    raise exception 'FALLO 7b: la venta de R3 desapareció';
  end if;
  if (select count(*) from public.clients where id = 'cccccccc-0000-0000-0000-000000000003') <> 1 then
    raise exception 'FALLO 8: el cliente de R3 desapareció';
  end if;
end $$;

-- ------------------------------------------------------------- R4 inactivo
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000004","role":"authenticated"}', true);
set local role authenticated;
-- 10. Un usuario desactivado no ve nada, ni lo suyo.
do $$ begin
  if exists (select 1 from public.clients) or exists (select 1 from public.subscriptions) then
    raise exception 'FALLO 10: un revendedor inactivo todavía ve datos';
  end if;
end $$;
reset role;

-- ------------------------------------------------------------------ anon
set local role anon;
-- 11. anon no tiene acceso.
do $$ declare ok boolean := false; n int; begin
  begin select count(*) into n from public.subscriptions; if n = 0 then ok := true; end if;
  exception when others then ok := true; end;
  if not ok then raise exception 'FALLO 11: anon puede leer suscripciones'; end if;
end $$;
reset role;

-- ------------------------------------------------------------------ Admin
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;

-- 12. El admin ve todo.
do $$ begin
  if (select count(*) from public.subscriptions where id::text like 'eeeeeeee-%') <> 4 then
    raise exception 'FALLO 12: el admin no ve las ventas de todos';
  end if;
  if (select count(*) from public.profiles where id::text like 'aaaaaaaa-%') <> 4 then
    raise exception 'FALLO 12: el admin no ve todos los perfiles';
  end if;
end $$;

-- 13. El admin registra una venta para R3 con datos de R3.
do $$ declare v_id uuid; v_owner uuid; begin
  select public.create_subscription_v3(
      p_client_id => 'cccccccc-0000-0000-0000-000000000003', p_product_id => 'dddddddd-0000-0000-0000-000000000003',
      p_provider_id => 'bbbbbbbb-0000-0000-0000-000000000003', p_username_email => 'x@example.com', p_password => 'x',
      p_profile => null, p_pin => null, p_access_url => null, p_sale_price => 10, p_cost => 5,
      p_sale_currency => 'PEN', p_cost_currency => 'PEN', p_sale_exchange_rate => null, p_cost_exchange_rate => null,
      p_start_date => current_date, p_expiry_date => current_date + 30, p_provider_expiry_date => null,
      p_extras => '{}'::jsonb, p_notes => null, p_idempotency_key => gen_random_uuid(),
      p_owner_id => 'aaaaaaaa-0000-0000-0000-000000000003') into v_id;
  -- Si la RPC devuelve otra cosa que el id, ajusta esta lectura sin debilitar la comprobación del dueño.
  select owner_id into v_owner from public.subscriptions where id = v_id;
  if v_owner is distinct from 'aaaaaaaa-0000-0000-0000-000000000003' then
    raise exception 'FALLO 13: la venta creada por el admin para R3 no quedó a nombre de R3 (owner=%)', v_owner;
  end if;
end $$;

-- 14. Ni el admin puede mezclar dueños (venta de R3 con cliente de R2).
do $$ declare ok boolean := false; begin
  begin perform public.create_subscription_v3(
      p_client_id => 'cccccccc-0000-0000-0000-000000000002', p_product_id => 'dddddddd-0000-0000-0000-000000000003',
      p_provider_id => null, p_username_email => null, p_password => null, p_profile => null, p_pin => null,
      p_access_url => null, p_sale_price => 10, p_cost => 5, p_sale_currency => 'PEN', p_cost_currency => 'PEN',
      p_sale_exchange_rate => null, p_cost_exchange_rate => null, p_start_date => current_date,
      p_expiry_date => current_date + 30, p_provider_expiry_date => null, p_extras => '{}'::jsonb, p_notes => null,
      p_idempotency_key => gen_random_uuid(), p_owner_id => 'aaaaaaaa-0000-0000-0000-000000000003');
  exception when others then ok := true; end;
  if not ok then raise exception 'FALLO 14: se creó una venta de R3 con el cliente de R2'; end if;
end $$;
reset role;

-- 15. Renovaciones: R2 solo ve las de sus ventas (se crea una renovación para R2 y otra para R3).
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select public.process_renewal(p_subscription_id => 'eeeeeeee-0000-0000-0000-000000000003',
       p_period_value => 1, p_period_unit => 'month', p_idempotency_key => gen_random_uuid());
reset role;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  if exists (select 1 from public.subscription_renewals where subscription_id = 'eeeeeeee-0000-0000-0000-000000000003') then
    raise exception 'FALLO 15: R2 ve renovaciones de las ventas de R3';
  end if;
end $$;
reset role;

do $$ begin raise notice 'TODAS LAS PRUEBAS PASARON (1-15)'; end $$;

rollback;
