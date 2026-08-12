create table if not exists public.t_academic_year (
  academic_year text primary key,
  is_active boolean not null default false,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table public.t_academic_year enable row level security;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_t_academic_year_updated_at on public.t_academic_year;

create trigger set_t_academic_year_updated_at
before update on public.t_academic_year
for each row
execute function public.set_updated_at();
