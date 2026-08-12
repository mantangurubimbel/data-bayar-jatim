insert into public.t_region (region_id, region_name)
values
  (0, 'HQ'),
  (1, 'Regional - Madiun Raya'),
  (2, 'Regional - Malang Raya'),
  (3, 'Regional - Mojokerto Raya'),
  (4, 'Regional - Tapal Kuda')
on conflict (region_id) do update
set
  region_name = excluded.region_name,
  updated_at = now();
