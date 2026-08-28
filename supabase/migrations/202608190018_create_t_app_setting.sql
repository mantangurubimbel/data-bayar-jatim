create table if not exists public.t_app_setting (
  setting_key text primary key,
  setting_value jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint t_app_setting_key_not_blank check (btrim(setting_key) <> '')
);

alter table public.t_app_setting enable row level security;

drop trigger if exists set_t_app_setting_updated_at on public.t_app_setting;

create trigger set_t_app_setting_updated_at
before update on public.t_app_setting
for each row
execute function public.set_updated_at();



insert into public.t_app_setting (setting_key, setting_value)
values (
  'maintenance',
  jsonb_build_object(
    'enabled', false,
    'message', 'Dalam perbaikan'
  )
)
on conflict (setting_key) do nothing;
