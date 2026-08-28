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
