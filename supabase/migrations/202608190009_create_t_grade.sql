create table if not exists public.t_grade (
  grade_id integer primary key,
  grade text not null,
  level text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table public.t_grade enable row level security;

drop trigger if exists set_t_grade_updated_at on public.t_grade;

create trigger set_t_grade_updated_at
before update on public.t_grade
for each row
execute function public.set_updated_at();

insert into public.t_grade (grade_id, grade, level)
values
  (3, '3 SD', 'SD'),
  (4, '4 SD', 'SD'),
  (5, '5 SD', 'SD'),
  (6, '6 SD', 'SD'),
  (7, '7 SMP', 'SMP'),
  (8, '8 SMP', 'SMP'),
  (9, '9 SMP', 'SMP'),
  (10, '10 SMA', 'SMA'),
  (11, '11 SMA', 'SMA'),
  (12, '12 SMA', 'SMA'),
  (13, 'Gapyear', 'SMA')
on conflict (grade_id) do update
set
  grade = excluded.grade,
  level = excluded.level,
  updated_at = now();
