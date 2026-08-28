create table if not exists public.t_app_user (
  id uuid primary key references auth.users (id) on delete cascade,
  name text,
  email text,
  position_id integer,
  role_id text not null default 'viewer',
  access_revenue_dashboard boolean not null default false,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),

  constraint t_app_user_role_id_fkey foreign key (role_id)
    references public.t_role (role_id),
  constraint t_app_user_position_id_fkey foreign key (position_id)
    references public.t_position (position_id),
  constraint t_app_user_email_format check (
    email is null or email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
  ),
  constraint t_app_user_email_unique unique (email)
);

create index if not exists t_app_user_email_idx on public.t_app_user (email);
create index if not exists t_app_user_role_id_idx on public.t_app_user (role_id);
create index if not exists t_app_user_position_id_idx on public.t_app_user (position_id);

alter table public.t_app_user enable row level security;

drop trigger if exists set_t_app_user_updated_at on public.t_app_user;

create trigger set_t_app_user_updated_at
before update on public.t_app_user
for each row
execute function public.set_updated_at();

create or replace function public.current_app_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role_id
  from public.t_app_user
  where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(public.current_app_role() in ('admin', 'admin_limited'), false)
$$;

create or replace function public.has_branch_access(target_branch_id integer)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    public.is_admin()
    or exists (
      select 1
      from public.t_app_user_branch
      where user_id = auth.uid()
        and branch_id = target_branch_id
    ),
    false
  )
$$;
