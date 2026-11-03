-- Simula lo que hace HOY el frontend (sin cambios) con la sesión de Alex, tras aplicar v8.
begin;
select set_config('request.jwt.claims', '{"sub":"3d8f71db-5e06-4859-92d6-acb57e90b74b","role":"authenticated"}', true);
set local role authenticated;
-- Lecturas que hace state.js / vistas
select 've ventas', count(*) from public.subscriptions;
select 've renovaciones', count(*) from public.subscription_renewals;
-- Alta de cliente y producto como lo hace el frontend (sin owner_id en el payload)
insert into public.clients (name, phone) values ('Nuevo cliente', '999111222') returning 'cliente creado, owner=Alex? ' || (owner_id = auth.uid());
insert into public.products (name, sale_price) values ('Disney+', 10) returning 'producto creado';
-- Venta como subscriptionForm.js (sin p_owner_id)
select 'venta creada' from public.create_subscription_v3(
  p_client_id => (select id from public.clients where name='Nuevo cliente'), p_product_id => (select id from public.products where name='Disney+'),
  p_provider_id => null, p_username_email => 'u@x.com', p_password => 'p', p_profile => null, p_pin => null, p_access_url => null,
  p_sale_price => 10, p_cost => 5, p_sale_currency => 'PEN', p_cost_currency => 'PEN', p_sale_exchange_rate => null,
  p_cost_exchange_rate => null, p_start_date => current_date, p_expiry_date => current_date + 30,
  p_provider_expiry_date => null, p_extras => '{}'::jsonb, p_notes => null, p_idempotency_key => gen_random_uuid());
-- Editar una venta existente (la de Liz también, Alex es admin)
update public.subscriptions set notes = 'editada' where id = '44444444-0000-0000-0000-000000000002' returning 'venta de Liz editada por Alex';
-- Renovar
select 'renovada hasta ' || new_expiry_date from public.process_renewal(p_subscription_id => '44444444-0000-0000-0000-000000000001', p_period_value => 1, p_period_unit => 'month', p_idempotency_key => gen_random_uuid());
-- Plantillas: upsert de whatsappTemplates.js (PostgREST usa la PK como conflicto; owner_id toma su default)
insert into public.whatsapp_templates (id, content) values ('reminder', 'nuevo texto')
  on conflict (owner_id, id) do update set content = excluded.content returning 'plantilla actualizada';
-- Liz (admin) sigue viendo todo
reset role;
select set_config('request.jwt.claims', '{"sub":"742a761c-983e-41ba-864f-9394514d98f5","role":"authenticated"}', true);
set local role authenticated;
select 'Liz ve ventas', count(*) from public.subscriptions;
rollback;

-- Liz (admin en la cuenta de Alex) registra una venta con la app actual usando el catálogo común.
begin;
select set_config('request.jwt.claims', '{"sub":"742a761c-983e-41ba-864f-9394514d98f5","role":"authenticated"}', true);
set local role authenticated;
insert into public.clients (name) values ('Cliente nuevo de Liz');
select 'venta de Liz creada' from public.create_subscription_v3(
  p_client_id => (select id from public.clients where name='Cliente nuevo de Liz'), p_product_id => '22222222-0000-0000-0000-000000000001',
  p_provider_id => null, p_username_email => null, p_password => null, p_profile => null, p_pin => null, p_access_url => null,
  p_sale_price => 10, p_cost => 5, p_sale_currency => 'PEN', p_cost_currency => 'PEN', p_sale_exchange_rate => null,
  p_cost_exchange_rate => null, p_start_date => current_date, p_expiry_date => current_date + 30,
  p_provider_expiry_date => null, p_extras => '{}'::jsonb, p_notes => null, p_idempotency_key => gen_random_uuid());
rollback;
