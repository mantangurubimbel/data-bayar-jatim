create table if not exists public.t_students (
  nis varchar(12) not null primary key,
  payment_date date not null,
  academic_year text not null,
  user_serial text not null,
  user_name text not null,
  user_phone varchar(15),
  birth_date date,
  email text,
  grade_id integer,
  npsn text,
  rombel_id integer,
  parents_name text,
  parents_phone varchar(15),
  agent_id integer,
  payment_id integer,
  status text not null default 'Active',
  branch_id integer,
  operator text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),

  constraint t_students_nis_length check (char_length(nis) = 12),
  constraint t_students_user_phone_digits check (
    user_phone is null or user_phone ~ '^[0-9]{8,15}$'
  ),
  constraint t_students_email_format check (
    email is null or email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
  ),
  constraint t_students_npsn_length check (
    npsn is null or char_length(npsn) = 8
  ),
  constraint t_students_parents_phone_digits check (
    parents_phone is null or parents_phone ~ '^[0-9]{8,15}$'
  ),
  constraint t_students_operator_email_format check (
    operator is null or operator ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
  ),
  constraint t_students_status_value check (
    status in ('Active', 'Inactive', 'Deleted')
  ),
  constraint t_students_branch_id_fkey foreign key (branch_id)
    references public.t_branch (branch_id),
  constraint t_students_npsn_fkey foreign key (npsn)
    references public.t_master_school (npsn),
  constraint t_students_agent_id_fkey foreign key (agent_id)
    references public.t_agent (agent_id),
  constraint t_students_payment_id_fkey foreign key (payment_id)
    references public.t_payment_method (payment_id),
  constraint t_students_rombel_id_fkey foreign key (rombel_id)
    references public.t_rombel (rombel_id),
  constraint t_students_grade_id_fkey foreign key (grade_id)
    references public.t_grade (grade_id),
  constraint t_students_academic_year_fkey foreign key (academic_year)
    references public.t_academic_year (academic_year) not valid
);

create index if not exists t_students_nis_idx on public.t_students (nis);
create index if not exists t_students_email_idx on public.t_students (email);
create index if not exists t_students_payment_date_idx on public.t_students (payment_date);
create index if not exists t_students_branch_id_idx on public.t_students (branch_id);
create index if not exists t_students_npsn_idx on public.t_students (npsn);
create index if not exists t_students_agent_id_idx on public.t_students (agent_id);
create index if not exists t_students_payment_id_idx on public.t_students (payment_id);
create index if not exists t_students_rombel_id_idx on public.t_students (rombel_id);
create index if not exists t_students_grade_id_idx on public.t_students (grade_id);

alter table public.t_students enable row level security;

drop trigger if exists set_t_students_updated_at on public.t_students;

create trigger set_t_students_updated_at
before update on public.t_students
for each row
execute function public.set_updated_at();
