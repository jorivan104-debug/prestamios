-- RBAC + negocio préstamos (Supabase Postgres)
-- Ejecutar en un proyecto Supabase vacío o revisar conflictos si ya hay esquema.

-- ---------------------------------------------------------------------------
-- Catálogo de permisos
-- ---------------------------------------------------------------------------
create table if not exists public.permissions (
  id text primary key,
  description text not null,
  module text not null
);

alter table public.permissions enable row level security;

drop policy if exists permissions_select on public.permissions;
create policy permissions_select
  on public.permissions for select
  to authenticated
  using (true);

insert into public.permissions (id, description, module) values
  ('app.dashboard.view', 'Ver panel', 'app'),
  ('clients.read', 'Ver clientes', 'clientes'),
  ('clients.create', 'Crear clientes', 'clientes'),
  ('clients.update', 'Editar clientes', 'clientes'),
  ('clients.delete', 'Eliminar clientes', 'clientes'),
  ('loans.read', 'Ver préstamos', 'prestamos'),
  ('loans.create', 'Crear préstamos', 'prestamos'),
  ('loans.update', 'Editar préstamos', 'prestamos'),
  ('payments.read', 'Ver pagos', 'pagos'),
  ('payments.create', 'Registrar pagos', 'pagos'),
  ('org.settings.manage', 'Configuración organización', 'configuracion'),
  ('users.invite', 'Invitar miembros', 'equipo'),
  ('users.remove', 'Quitar miembros', 'equipo'),
  ('users.assign_role', 'Asignar rol', 'equipo'),
  ('roles.read', 'Ver roles', 'equipo'),
  ('roles.create', 'Crear roles', 'equipo'),
  ('roles.update', 'Editar roles y permisos', 'equipo'),
  ('roles.delete', 'Eliminar roles', 'equipo')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Organizaciones y perfiles
-- ---------------------------------------------------------------------------
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_data_url text,
  currency text not null default 'EUR',
  default_annual_rate numeric(12, 4) not null default 24,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  updated_at timestamptz not null default now()
);

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  description text,
  is_system boolean not null default false,
  unique (organization_id, name)
);

create table if not exists public.role_permissions (
  role_id uuid not null references public.roles (id) on delete cascade,
  permission_id text not null references public.permissions (id) on delete cascade,
  primary key (role_id, permission_id)
);

create table if not exists public.organization_members (
  user_id uuid not null references auth.users (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  role_id uuid not null references public.roles (id),
  primary key (user_id, organization_id)
);

-- ---------------------------------------------------------------------------
-- Función: comprobar permiso
-- ---------------------------------------------------------------------------
create or replace function public.user_has_permission(p_org uuid, p_perm text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return false;
  end if;
  return exists (
    select 1
    from public.organization_members m
    join public.role_permissions rp on rp.role_id = m.role_id
    where m.user_id = auth.uid()
      and m.organization_id = p_org
      and rp.permission_id = p_perm
  );
end;
$$;

grant execute on function public.user_has_permission(uuid, text) to authenticated;

create or replace function public.get_my_permissions(p_org uuid)
returns table (permission_id text)
language sql
stable
security definer
set search_path = public
as $$
  select rp.permission_id
  from public.organization_members m
  join public.role_permissions rp on rp.role_id = m.role_id
  where m.user_id = auth.uid()
    and m.organization_id = p_org;
$$;

grant execute on function public.get_my_permissions(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Bootstrap: primera organización del usuario
-- ---------------------------------------------------------------------------
create or replace function public.bootstrap_my_organization(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_role uuid;
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if exists (select 1 from public.organization_members where user_id = uid) then
    raise exception 'user_already_has_organization';
  end if;
  if trim(p_name) = '' then
    raise exception 'invalid_org_name';
  end if;

  insert into public.organizations (name)
  values (trim(p_name))
  returning id into v_org;

  insert into public.roles (organization_id, name, description, is_system)
  values (v_org, 'Propietario', 'Control total del sistema', true)
  returning id into v_role;

  insert into public.role_permissions (role_id, permission_id)
  select v_role, p.id from public.permissions p;

  insert into public.organization_members (user_id, organization_id, role_id)
  values (uid, v_org, v_role);

  insert into public.profiles (id, display_name)
  values (uid, null)
  on conflict (id) do nothing;

  return v_org;
end;
$$;

grant execute on function public.bootstrap_my_organization(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Listado de miembros (email desde auth.users)
-- ---------------------------------------------------------------------------
create or replace function public.list_organization_members(p_org uuid)
returns table (user_id uuid, email text, role_id uuid, role_name text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if not exists (
    select 1 from public.organization_members m
    where m.organization_id = p_org and m.user_id = auth.uid()
  ) then
    raise exception 'not_member';
  end if;
  if not public.user_has_permission(p_org, 'roles.read')
     and not public.user_has_permission(p_org, 'users.invite') then
    raise exception 'forbidden';
  end if;

  return query
  select m.user_id, u.email::text, m.role_id, r.name
  from public.organization_members m
  join public.roles r on r.id = m.role_id
  join auth.users u on u.id = m.user_id
  where m.organization_id = p_org;
end;
$$;

grant execute on function public.list_organization_members(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Negocio: clientes, préstamos, cuotas, pagos
-- ---------------------------------------------------------------------------
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  document text default '',
  phone text,
  email text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.loans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete restrict,
  principal numeric(18, 4) not null,
  annual_rate numeric(12, 4) not null,
  term_count integer not null,
  frequency text not null check (frequency in ('monthly', 'biweekly', 'weekly')),
  start_date date not null,
  status text not null default 'active' check (status in ('active', 'closed')),
  created_at timestamptz not null default now()
);

create table if not exists public.installments (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.loans (id) on delete cascade,
  number integer not null,
  due_date date not null,
  principal numeric(18, 4) not null,
  interest numeric(18, 4) not null,
  total numeric(18, 4) not null,
  paid numeric(18, 4) not null default 0,
  status text not null default 'pending',
  unique (loan_id, number)
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  loan_id uuid not null references public.loans (id) on delete cascade,
  date date not null,
  amount numeric(18, 4) not null,
  method text,
  note text,
  allocations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.organization_members enable row level security;
alter table public.clients enable row level security;
alter table public.loans enable row level security;
alter table public.installments enable row level security;
alter table public.payments enable row level security;

-- organizations
drop policy if exists orgs_select on public.organizations;
create policy orgs_select on public.organizations for select to authenticated using (
  id in (select organization_id from public.organization_members where user_id = auth.uid())
);

drop policy if exists orgs_update on public.organizations;
create policy orgs_update on public.organizations for update to authenticated using (
  id in (select organization_id from public.organization_members where user_id = auth.uid())
  and public.user_has_permission(id, 'org.settings.manage')
) with check (
  id in (select organization_id from public.organization_members where user_id = auth.uid())
);

-- profiles (own row)
drop policy if exists profiles_all on public.profiles;
create policy profiles_all on public.profiles for all to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- organization_members
drop policy if exists om_select on public.organization_members;
create policy om_select on public.organization_members for select to authenticated using (
  organization_id in (select organization_id from public.organization_members m2 where m2.user_id = auth.uid())
);

-- roles
drop policy if exists roles_select on public.roles;
create policy roles_select on public.roles for select to authenticated using (
  organization_id in (select organization_id from public.organization_members where user_id = auth.uid())
  and public.user_has_permission(organization_id, 'roles.read')
);

drop policy if exists roles_insert on public.roles;
create policy roles_insert on public.roles for insert to authenticated with check (
  organization_id in (select organization_id from public.organization_members where user_id = auth.uid())
  and public.user_has_permission(organization_id, 'roles.create')
);

drop policy if exists roles_update on public.roles;
create policy roles_update on public.roles for update to authenticated using (
  organization_id in (select organization_id from public.organization_members where user_id = auth.uid())
  and public.user_has_permission(organization_id, 'roles.update')
) with check (
  organization_id in (select organization_id from public.organization_members where user_id = auth.uid())
);

drop policy if exists roles_delete on public.roles;
create policy roles_delete on public.roles for delete to authenticated using (
  organization_id in (select organization_id from public.organization_members where user_id = auth.uid())
  and public.user_has_permission(organization_id, 'roles.delete')
  and is_system = false
);

-- role_permissions
drop policy if exists rp_select on public.role_permissions;
create policy rp_select on public.role_permissions for select to authenticated using (
  exists (
    select 1 from public.roles r
    where r.id = role_permissions.role_id
      and r.organization_id in (
        select organization_id from public.organization_members where user_id = auth.uid()
      )
  )
  and exists (
    select 1 from public.roles r2
    where r2.id = role_permissions.role_id
      and public.user_has_permission(r2.organization_id, 'roles.read')
  )
);

drop policy if exists rp_insert on public.role_permissions;
create policy rp_insert on public.role_permissions for insert to authenticated with check (
  exists (
    select 1 from public.roles r
    where r.id = role_permissions.role_id
      and public.user_has_permission(r.organization_id, 'roles.update')
  )
);

drop policy if exists rp_delete on public.role_permissions;
create policy rp_delete on public.role_permissions for delete to authenticated using (
  exists (
    select 1 from public.roles r
    where r.id = role_permissions.role_id
      and public.user_has_permission(r.organization_id, 'roles.update')
  )
);

-- organization_members mutations (asignación de rol)
drop policy if exists om_update on public.organization_members;
create policy om_update on public.organization_members for update to authenticated using (
  organization_id in (select organization_id from public.organization_members m where m.user_id = auth.uid())
  and public.user_has_permission(organization_id, 'users.assign_role')
) with check (
  organization_id in (select organization_id from public.organization_members m where m.user_id = auth.uid())
);

-- clients
drop policy if exists clients_select on public.clients;
create policy clients_select on public.clients for select to authenticated using (
  organization_id in (select organization_id from public.organization_members where user_id = auth.uid())
  and public.user_has_permission(organization_id, 'clients.read')
);

drop policy if exists clients_insert on public.clients;
create policy clients_insert on public.clients for insert to authenticated with check (
  organization_id in (select organization_id from public.organization_members where user_id = auth.uid())
  and public.user_has_permission(organization_id, 'clients.create')
);

drop policy if exists clients_update on public.clients;
create policy clients_update on public.clients for update to authenticated using (
  organization_id in (select organization_id from public.organization_members where user_id = auth.uid())
  and public.user_has_permission(organization_id, 'clients.update')
) with check (
  organization_id in (select organization_id from public.organization_members where user_id = auth.uid())
);

drop policy if exists clients_delete on public.clients;
create policy clients_delete on public.clients for delete to authenticated using (
  organization_id in (select organization_id from public.organization_members where user_id = auth.uid())
  and public.user_has_permission(organization_id, 'clients.delete')
);

-- loans
drop policy if exists loans_select on public.loans;
create policy loans_select on public.loans for select to authenticated using (
  organization_id in (select organization_id from public.organization_members where user_id = auth.uid())
  and public.user_has_permission(organization_id, 'loans.read')
);

drop policy if exists loans_insert on public.loans;
create policy loans_insert on public.loans for insert to authenticated with check (
  organization_id in (select organization_id from public.organization_members where user_id = auth.uid())
  and public.user_has_permission(organization_id, 'loans.create')
);

drop policy if exists loans_update on public.loans;
create policy loans_update on public.loans for update to authenticated using (
  organization_id in (select organization_id from public.organization_members where user_id = auth.uid())
  and public.user_has_permission(organization_id, 'loans.update')
) with check (
  organization_id in (select organization_id from public.organization_members where user_id = auth.uid())
);

-- installments (acceso vía préstamo)
drop policy if exists inst_select on public.installments;
create policy inst_select on public.installments for select to authenticated using (
  exists (
    select 1 from public.loans l
    where l.id = installments.loan_id
      and l.organization_id in (select organization_id from public.organization_members where user_id = auth.uid())
      and public.user_has_permission(l.organization_id, 'loans.read')
  )
);

drop policy if exists inst_insert on public.installments;
create policy inst_insert on public.installments for insert to authenticated with check (
  exists (
    select 1 from public.loans l
    where l.id = loan_id
      and public.user_has_permission(l.organization_id, 'loans.create')
  )
);

drop policy if exists inst_update on public.installments;
create policy inst_update on public.installments for update to authenticated using (
  exists (
    select 1 from public.loans l
    where l.id = installments.loan_id
      and public.user_has_permission(l.organization_id, 'loans.update')
  )
) with check (
  exists (
    select 1 from public.loans l
    where l.id = installments.loan_id
      and public.user_has_permission(l.organization_id, 'loans.update')
  )
);

drop policy if exists inst_delete on public.installments;
create policy inst_delete on public.installments for delete to authenticated using (
  exists (
    select 1 from public.loans l
    where l.id = installments.loan_id
      and public.user_has_permission(l.organization_id, 'loans.update')
  )
);

-- payments
drop policy if exists pay_select on public.payments;
create policy pay_select on public.payments for select to authenticated using (
  organization_id in (select organization_id from public.organization_members where user_id = auth.uid())
  and public.user_has_permission(organization_id, 'payments.read')
);

drop policy if exists pay_insert on public.payments;
create policy pay_insert on public.payments for insert to authenticated with check (
  organization_id in (select organization_id from public.organization_members where user_id = auth.uid())
  and public.user_has_permission(organization_id, 'payments.create')
);
