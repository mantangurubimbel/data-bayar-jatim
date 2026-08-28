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
  ('admin_limited', 'Admin Terbatas'),
  ('operator', 'Operator'),
  ('viewer', 'Viewer')
on conflict (role_id) do update
set
  role_name = excluded.role_name,
  updated_at = now();
