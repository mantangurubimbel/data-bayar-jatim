create table if not exists public.t_master_school (
  npsn text primary key,
  name text not null,
  level varchar(3) not null,
  status varchar(6) not null,
  address text,
  district text,
  city text,
  province text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),

  constraint t_master_school_npsn_length check (char_length(npsn) = 8)
);

create index if not exists t_master_school_name_idx on public.t_master_school (name);
create index if not exists t_master_school_city_idx on public.t_master_school (city);
create index if not exists t_master_school_province_idx on public.t_master_school (province);

alter table public.t_master_school enable row level security;

drop trigger if exists set_t_master_school_updated_at on public.t_master_school;

create trigger set_t_master_school_updated_at
before update on public.t_master_school
for each row
execute function public.set_updated_at();
