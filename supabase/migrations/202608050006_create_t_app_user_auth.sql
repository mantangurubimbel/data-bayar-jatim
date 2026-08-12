create table if not exists public.t_role (
  role_id text primary key,
  role_name text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table public.t_role enable row level security;

drop trigger if exists set_t_role_updated_at on public.t_role;

create trigger set_t_role_updated_at
before update on public.t_role
for each row
execute function public.set_updated_at();

insert into public.t_role (role_id, role_name)
values
  ('admin', 'Admin'),
  ('operator', 'Operator'),
  ('viewer', 'Viewer')
on conflict (role_id) do update
set
  role_name = excluded.role_name,
  updated_at = now();

create table if not exists public.t_app_user (
  id uuid primary key references auth.users (id) on delete cascade,
  name text,
  email text,
  position text,
  role_id text not null default 'viewer',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),

  constraint t_app_user_role_id_fkey foreign key (role_id)
    references public.t_role (role_id),
  constraint t_app_user_email_format check (
    email is null or email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
  ),
  constraint t_app_user_email_unique unique (email)
);

create index if not exists t_app_user_email_idx on public.t_app_user (email);
create index if not exists t_app_user_role_id_idx on public.t_app_user (role_id);

alter table public.t_app_user enable row level security;

drop trigger if exists set_t_app_user_updated_at on public.t_app_user;

create trigger set_t_app_user_updated_at
before update on public.t_app_user
for each row
execute function public.set_updated_at();

create table if not exists public.t_app_user_branch (
  user_id uuid not null,
  branch_id integer not null,
  created_at timestamp with time zone not null default now(),

  constraint t_app_user_branch_pkey primary key (user_id, branch_id),
  constraint t_app_user_branch_user_id_fkey foreign key (user_id)
    references public.t_app_user (id) on delete cascade,
  constraint t_app_user_branch_branch_id_fkey foreign key (branch_id)
    references public.t_branch (branch_id)
);

create index if not exists t_app_user_branch_branch_id_idx on public.t_app_user_branch (branch_id);

alter table public.t_app_user_branch enable row level security;
