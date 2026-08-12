create table if not exists public.t_branch (
  branch_id integer primary key,
  branch_name text not null,
  region_id integer not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),

  constraint t_branch_branch_id_digits check (branch_id between 100 and 999),
  constraint t_branch_region_id_fkey foreign key (region_id)
    references public.t_region (region_id)
);

create index if not exists t_branch_branch_name_idx on public.t_branch (branch_name);
create index if not exists t_branch_region_id_idx on public.t_branch (region_id);

alter table public.t_branch enable row level security;

drop trigger if exists set_t_branch_updated_at on public.t_branch;

create trigger set_t_branch_updated_at
before update on public.t_branch
for each row
execute function public.set_updated_at();

insert into public.t_branch (branch_id, branch_name, region_id)
values
  (102, 'Tulungagung - Dr. Wahidin', 1),
  (103, 'Madiun - Sutomo', 1),
  (105, 'Ponorogo - Bhayangkara', 1),
  (106, 'Magetan - Monginsidi', 1),
  (109, 'Ngawi - Gading', 1),
  (110, 'Tulungagung - Boyolangu', 1),
  (111, 'Trenggalek - Menak Sopal', 1),
  (112, 'Madiun - Caruban', 1),
  (113, 'Pacitan - Baleharjo', 1),
  (201, 'Malang - Klojen', 2),
  (202, 'Malang - Sawojajar', 2),
  (203, 'Malang - Kepanjen', 2),
  (204, 'Batu - Agus Salim', 2),
  (205, 'Malang - Lawang', 2),
  (206, 'Lumajang - Tompokersan', 2),
  (101, 'Kediri - Hasanudin', 3),
  (107, 'Blitar - Bung Karno', 3),
  (108, 'Pare - Sudirman', 3),
  (301, 'Mojokerto - Airlangga', 3),
  (303, 'Jombang - Kapten Tendean', 3),
  (305, 'Mojokerto - Jayanegara', 3),
  (309, 'Jombang - Mojoagung', 3),
  (310, 'Mojokerto - Letkol Sumarjo', 3),
  (401, 'Jember - Sumbersari', 4),
  (402, 'Banyuwangi - Brawijaya', 4),
  (403, 'Probolinggo - Slamet Riyadi', 4),
  (404, 'Probolinggo - Kraksaan', 4),
  (405, 'Banyuwangi - Genteng', 4),
  (406, 'Bondowoso - Diponegoro', 4),
  (407, 'Situbondo - Basuki Rahmat', 4)
on conflict (branch_id) do update
set
  branch_name = excluded.branch_name,
  region_id = excluded.region_id,
  updated_at = now();
