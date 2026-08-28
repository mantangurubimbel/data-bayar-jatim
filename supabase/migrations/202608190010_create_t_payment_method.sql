create table if not exists public.t_payment_method (
  payment_id integer primary key,
  payment_method text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table public.t_payment_method enable row level security;

drop trigger if exists set_t_payment_method_updated_at on public.t_payment_method;

create trigger set_t_payment_method_updated_at
before update on public.t_payment_method
for each row
execute function public.set_updated_at();

insert into public.t_payment_method (payment_id, payment_method)
values
  (1, 'Lunas'),
  (2, 'Cicilan 2x'),
  (3, 'Cicilan 3x'),
  (4, 'Cicilan 4x'),
  (5, 'Cicilan 5x'),
  (6, 'DP + Pelunasan'),
  (7, 'DP + Cicilan 2x')
on conflict (payment_id) do update
set
  payment_method = excluded.payment_method,
  updated_at = now();
