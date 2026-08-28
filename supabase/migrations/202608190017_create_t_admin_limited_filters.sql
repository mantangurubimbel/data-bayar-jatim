create table if not exists public.t_admin_limited_role_filter (
  role_id text primary key references public.t_role (role_id) on delete cascade,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.t_admin_limited_position_filter (
  position_id integer primary key references public.t_position (position_id) on delete cascade,
  created_at timestamp with time zone not null default now()
);

alter table public.t_admin_limited_role_filter enable row level security;
alter table public.t_admin_limited_position_filter enable row level security;





insert into public.t_admin_limited_role_filter (role_id)
values ('operator'), ('viewer')
on conflict (role_id) do nothing;

insert into public.t_admin_limited_position_filter (position_id)
select position_id
from public.t_position
where lower(position_name) <> 'guest'
on conflict (position_id) do nothing;
