-- Datos ficticios con la forma actual (pre-v8): Alex y Liz comparten todo.
insert into auth.users (id, email, aud, role) values
 ('3d8f71db-5e06-4859-92d6-acb57e90b74b','alex@example.com','authenticated','authenticated'),
 ('742a761c-983e-41ba-864f-9394514d98f5','liz@example.com','authenticated','authenticated');
insert into public.providers (id, name) values ('11111111-0000-0000-0000-000000000001','Proveedor Uno');
insert into public.products (id, name, sale_price, provider_id) values ('22222222-0000-0000-0000-000000000001','Netflix',15,'11111111-0000-0000-0000-000000000001');
insert into public.clients (id, name, phone, created_by) values
 ('33333333-0000-0000-0000-000000000001','Cliente de Alex','999000001','3d8f71db-5e06-4859-92d6-acb57e90b74b'),
 ('33333333-0000-0000-0000-000000000002','Cliente de Liz','999000002','742a761c-983e-41ba-864f-9394514d98f5');
insert into public.subscriptions (id, client_id, product_id, provider_id, client_name, service, expiry_date, created_by) values
 ('44444444-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000001','Cliente de Alex','Netflix',current_date+5,'3d8f71db-5e06-4859-92d6-acb57e90b74b'),
 ('44444444-0000-0000-0000-000000000002','33333333-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000001',null,'Cliente de Liz','Netflix',current_date+9,'742a761c-983e-41ba-864f-9394514d98f5');
