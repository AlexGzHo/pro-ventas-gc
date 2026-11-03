#!/bin/bash
# Pruebas de mutación: introduce agujeros de seguridad a propósito y verifica que alguna prueba falla.
# Cada línea debe terminar en "FALLO n", salvo "Sin mutación", que debe terminar en "PASARON".
# Uso: supabase/tests/local/mutate.sh   (MIG=ruta para probar otra migración)
source "$(dirname "$0")/env.sh"

run() { # $1 = nombre, $2 = SQL que rompe algo
  "$LOCAL_DIR/build.sh" >/dev/null && $P -f "${MIG:-$REPO/supabase/drafts/v8_multi_revendedor.sql}" >/dev/null 2>&1
  [ -n "$2" ] && $P -c "$2" >/dev/null
  res=$($P -f $REPO/supabase/tests/rls_multirevendedor.sql 2>&1 | grep -oE "FALLO [0-9a-z]+[^\"]*|PASARON[^\"]*" | head -1)
  printf '%-58s -> %s\n' "$1" "$res"
}
run "Sin mutación (debe pasar)" ""
run "M1 política vieja permisiva olvidada en clients" "create policy legacy on public.clients for select to authenticated using (true)"
run "M2 renovar sin comprobar dueño" "create or replace function public.can_access(p_owner uuid) returns boolean language sql stable security definer set search_path='' as \$\$ select (select auth.uid()) is not null \$\$"
run "M3 sin trigger de integridad entre dueños" "drop trigger subscriptions_owner_integrity on public.subscriptions"
run "M4 revendedor puede editar perfiles" "create policy legacy on public.profiles for update to authenticated using (true) with check (true)"
run "M5 inactivo conserva acceso" "create or replace function public.current_account() returns uuid language sql stable security definer set search_path='' as \$\$ select account_id from public.profiles where id = (select auth.uid()) \$\$; create or replace function public.can_access(p_owner uuid) returns boolean language sql stable security definer set search_path='' as \$\$ select exists (select 1 from public.profiles where id=(select auth.uid()) and (role='admin' or account_id=p_owner)) \$\$"
run "M6 anon con permiso de lectura" "grant select on public.subscriptions to anon; create policy legacy_anon on public.subscriptions for select to anon using (true)"
run "M7 función vieja con firma anterior sin controles" "create function public.create_subscription_v3(p_client_id uuid, p_product_id uuid, p_provider_id uuid, p_username_email text, p_password text, p_profile text, p_pin text, p_access_url text, p_sale_price numeric, p_cost numeric, p_sale_currency text, p_cost_currency text, p_sale_exchange_rate numeric, p_cost_exchange_rate numeric, p_start_date date, p_expiry_date date, p_provider_expiry_date date, p_extras jsonb, p_notes text, p_idempotency_key uuid) returns table(subscription_id uuid, renewal_id uuid) language plpgsql security definer set search_path=public as \$f\$ begin insert into public.subscriptions(client_id, client_name, service, expiry_date, owner_id) values (p_client_id,'x','x',current_date,(select owner_id from public.clients where id=p_client_id)) returning id, null::uuid into subscription_id, renewal_id; return next; end \$f\$; grant execute on function public.create_subscription_v3(uuid, uuid, uuid, text, text, text, text, text, numeric, numeric, text, text, numeric, numeric, date, date, date, jsonb, text, uuid) to authenticated"
run "M8 función legada create_subscription restaurada" "create function public.create_subscription(p text) returns void language sql security definer as 'select 1'"
run "M9 dueño = persona en vez de cuenta (rompe a Liz)" "alter table public.clients alter column owner_id set default auth.uid()"
