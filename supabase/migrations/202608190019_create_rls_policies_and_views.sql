insert into public.t_academic_year (academic_year, is_active)
select distinct academic_year, false
from public.t_students
where academic_year is not null
on conflict (academic_year) do nothing;

insert into public.t_academic_year (academic_year, is_active)
select distinct academic_year, false
from public.t_rombel
where academic_year is not null
on conflict (academic_year) do nothing;

create or replace function public.current_app_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role_id
  from public.t_app_user
  where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(public.current_app_role() in ('admin', 'admin_limited'), false)
$$;

create or replace function public.has_branch_access(target_branch_id integer)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    public.is_admin()
    or exists (
      select 1
      from public.t_app_user_branch
      where user_id = auth.uid()
        and branch_id = target_branch_id
    ),
    false
  )
$$;

drop policy if exists "authenticated can read academic years" on public.t_academic_year;
create policy "authenticated can read academic years"
on public.t_academic_year for select
to authenticated
using (true);

drop policy if exists "admin can manage academic years" on public.t_academic_year;
create policy "admin can manage academic years"
on public.t_academic_year for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "authenticated can read roles" on public.t_role;
create policy "authenticated can read roles"
on public.t_role for select
to authenticated
using (true);

drop policy if exists "users can read own profile" on public.t_app_user;
create policy "users can read own profile"
on public.t_app_user for select
to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists "admin can manage app users" on public.t_app_user;
create policy "admin can manage app users"
on public.t_app_user for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "users can read own branch access" on public.t_app_user_branch;
create policy "users can read own branch access"
on public.t_app_user_branch for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "admin can manage user branch access" on public.t_app_user_branch;
create policy "admin can manage user branch access"
on public.t_app_user_branch for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "users can read accessible branches" on public.t_branch;
create policy "users can read accessible branches"
on public.t_branch for select
to authenticated
using (public.has_branch_access(branch_id));

drop policy if exists "admin can manage branches" on public.t_branch;
create policy "admin can manage branches"
on public.t_branch for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "authenticated can read master lookup tables" on public.t_region;
create policy "authenticated can read master lookup tables"
on public.t_region for select
to authenticated
using (true);

drop policy if exists "authenticated can read grades" on public.t_grade;
create policy "authenticated can read grades"
on public.t_grade for select
to authenticated
using (true);

drop policy if exists "authenticated can read payment methods" on public.t_payment_method;
create policy "authenticated can read payment methods"
on public.t_payment_method for select
to authenticated
using (true);

drop policy if exists "users can read accessible agents" on public.t_agent;
create policy "users can read accessible agents"
on public.t_agent for select
to authenticated
using (branch_id is null or public.has_branch_access(branch_id));

drop policy if exists "admin can manage agents" on public.t_agent;
create policy "admin can manage agents"
on public.t_agent for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "users can read accessible rombel" on public.t_rombel;
create policy "users can read accessible rombel"
on public.t_rombel for select
to authenticated
using (branch_id is null or public.has_branch_access(branch_id));

drop policy if exists "admin operator can manage accessible rombel" on public.t_rombel;
create policy "admin operator can manage accessible rombel"
on public.t_rombel for all
to authenticated
using (
  public.is_admin()
  or (public.current_app_role() = 'operator' and public.has_branch_access(branch_id))
)
with check (
  public.is_admin()
  or (public.current_app_role() = 'operator' and public.has_branch_access(branch_id))
);

drop policy if exists "users can read accessible branch schools" on public.t_branch_school;
create policy "users can read accessible branch schools"
on public.t_branch_school for select
to authenticated
using (public.has_branch_access(branch_id));

drop policy if exists "admin operator can manage accessible branch schools" on public.t_branch_school;
create policy "admin operator can manage accessible branch schools"
on public.t_branch_school for all
to authenticated
using (
  public.is_admin()
  or (public.current_app_role() = 'operator' and public.has_branch_access(branch_id))
)
with check (
  public.is_admin()
  or (public.current_app_role() = 'operator' and public.has_branch_access(branch_id))
);

drop policy if exists "authenticated can read schools" on public.t_master_school;
create policy "authenticated can read schools"
on public.t_master_school for select
to authenticated
using (true);

drop policy if exists "admin operator can manage schools" on public.t_master_school;
create policy "admin operator can manage schools"
on public.t_master_school for all
to authenticated
using (public.current_app_role() in ('admin', 'operator'))
with check (public.current_app_role() in ('admin', 'operator'));

drop policy if exists "users can read accessible students" on public.t_students;
create policy "users can read accessible students"
on public.t_students for select
to authenticated
using (branch_id is null or public.has_branch_access(branch_id));

drop policy if exists "admin operator can insert accessible students" on public.t_students;
create policy "admin operator can insert accessible students"
on public.t_students for insert
to authenticated
with check (
  public.is_admin()
  or (public.current_app_role() = 'operator' and public.has_branch_access(branch_id))
);

drop policy if exists "admin operator can update accessible students" on public.t_students;
create policy "admin operator can update accessible students"
on public.t_students for update
to authenticated
using (
  public.is_admin()
  or (public.current_app_role() = 'operator' and public.has_branch_access(branch_id))
)
with check (
  public.is_admin()
  or (public.current_app_role() = 'operator' and public.has_branch_access(branch_id))
);

drop policy if exists "admin can delete students" on public.t_students;
create policy "admin can delete students"
on public.t_students for delete
to authenticated
using (public.is_admin());

create or replace view public.v_student_detail
with (security_invoker = true)
as
select
  s.nis,
  s.payment_date,
  s.academic_year,
  s.user_serial,
  s.user_name,
  s.user_phone,
  s.birth_date,
  s.email,
  s.grade_id,
  g.grade,
  g.level,
  s.npsn,
  ms.name as school_name,
  s.rombel_id,
  r.rombel_name,
  s.parents_name,
  s.parents_phone,
  s.agent_id,
  a.agent_name,
  s.payment_id,
  pm.payment_method,
  s.status,
  s.branch_id,
  b.branch_name,
  b.region_id,
  rg.region_name,
  s.operator as operator_email,
  s.created_at,
  s.updated_at,
  (
    nullif(trim(coalesce(s.user_serial, '')), '') is null
    or s.birth_date is null
    or nullif(trim(coalesce(s.email, '')), '') is null
    or nullif(trim(coalesce(s.npsn, '')), '') is null
    or s.rombel_id is null
    or nullif(trim(coalesce(s.parents_name, '')), '') is null
    or nullif(trim(coalesce(s.parents_phone, '')), '') is null
    or s.agent_id is null
    or s.payment_id is null
  ) as is_incomplete
from public.t_students s
left join public.t_grade g on g.grade_id = s.grade_id
left join public.t_master_school ms on ms.npsn = s.npsn
left join public.t_rombel r on r.rombel_id = s.rombel_id
left join public.t_agent a on a.agent_id = s.agent_id
left join public.t_payment_method pm on pm.payment_id = s.payment_id
left join public.t_branch b on b.branch_id = s.branch_id
left join public.t_region rg on rg.region_id = b.region_id
where s.status <> 'Deleted';

create or replace view public.v_dashboard_summary
with (security_invoker = true)
as
with student_summary as (
  select
    branch_id,
    academic_year,
    count(*) as active_students,
    count(*) filter (
      where
        nullif(trim(coalesce(user_serial, '')), '') is null
        or birth_date is null
        or nullif(trim(coalesce(email, '')), '') is null
        or nullif(trim(coalesce(npsn, '')), '') is null
        or rombel_id is null
        or nullif(trim(coalesce(parents_name, '')), '') is null
        or nullif(trim(coalesce(parents_phone, '')), '') is null
        or agent_id is null
        or payment_id is null
    ) as incomplete_students,
    count(*) filter (where rombel_id is null) as students_without_rombel
  from public.t_students
  where status <> 'Deleted'
  group by branch_id, academic_year
),
school_summary as (
  select branch_id, count(distinct npsn) as branch_schools
  from public.t_students
  where status <> 'Deleted'
    and nullif(trim(coalesce(npsn, '')), '') is not null
  group by branch_id
),
rombel_summary as (
  select
    r.branch_id,
    r.academic_year,
    count(*) filter (
      where exists (
        select 1
        from public.t_students s
        where s.rombel_id = r.rombel_id
          and s.status <> 'Deleted'
      )
    ) as active_rombels,
    count(*) filter (
      where not exists (
        select 1
        from public.t_students s
        where s.rombel_id = r.rombel_id
          and s.status <> 'Deleted'
      )
    ) as empty_rombels
  from public.t_rombel r
  group by r.branch_id, r.academic_year
)
select
  b.branch_id,
  b.branch_name,
  b.region_id,
  ay.academic_year,
  coalesce(ss.active_students, 0) as active_students,
  coalesce(ss.incomplete_students, 0) as incomplete_students,
  coalesce(ss.students_without_rombel, 0) as students_without_rombel,
  coalesce(scs.branch_schools, 0) as branch_schools,
  coalesce(rs.active_rombels, 0) as active_rombels,
  coalesce(rs.empty_rombels, 0) as empty_rombels
from public.t_branch b
cross join public.t_academic_year ay
left join student_summary ss
  on ss.branch_id = b.branch_id
  and ss.academic_year = ay.academic_year
left join school_summary scs
  on scs.branch_id = b.branch_id
left join rombel_summary rs
  on rs.branch_id = b.branch_id
  and rs.academic_year = ay.academic_year;

create or replace view public.v_branch_school_detail
with (security_invoker = true)
as
select
  bs.id,
  bs.npsn,
  ms.name as school_name,
  ms.level,
  ms.status as school_status,
  ms.address,
  ms.district,
  ms.city,
  ms.province,
  bs.branch_id,
  b.branch_name,
  bs.created_at,
  bs.updated_at,
  coalesce(sc.student_count, 0) as student_count
from public.t_branch_school bs
left join public.t_master_school ms on ms.npsn = bs.npsn
left join public.t_branch b on b.branch_id = bs.branch_id
left join (
  select
    branch_id,
    npsn,
    count(*) as student_count
  from public.t_students
  where npsn is not null
    and status <> 'Deleted'
  group by branch_id, npsn
) sc on sc.branch_id = bs.branch_id
  and sc.npsn = bs.npsn;

create or replace view public.v_rombel_detail
with (security_invoker = true)
as
select
  r.rombel_id,
  r.academic_year,
  r.branch_id,
  b.branch_name,
  r.grade_id,
  g.grade,
  g.level,
  r.rombel_name,
  count(s.nis) as student_count,
  r.created_at,
  r.updated_at
from public.t_rombel r
left join public.t_branch b on b.branch_id = r.branch_id
left join public.t_grade g on g.grade_id = r.grade_id
left join public.t_students s on s.rombel_id = r.rombel_id
  and s.status <> 'Deleted'
group by
  r.rombel_id,
  r.academic_year,
  r.branch_id,
  b.branch_name,
  r.grade_id,
  g.grade,
  g.level,
  r.rombel_name,
  r.created_at,
  r.updated_at;

grant usage on schema public to authenticated;
grant select on public.v_student_detail to authenticated;
grant select on public.v_dashboard_summary to authenticated;
grant select on public.v_branch_school_detail to authenticated;
grant select on public.v_rombel_detail to authenticated;


drop policy if exists "authenticated can read positions" on public.t_position;
create policy "authenticated can read positions"
on public.t_position for select
to authenticated
using (true);

drop policy if exists "admin can manage positions" on public.t_position;
create policy "admin can manage positions"
on public.t_position for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admin can read admin audit logs" on public.t_admin_audit_log;
create policy "admin can read admin audit logs"
on public.t_admin_audit_log for select
to authenticated
using (public.is_admin());

grant select on public.t_admin_audit_log to authenticated;

drop policy if exists "admin can read google sheet sync logs" on public.t_google_sheet_sync_log;
create policy "admin can read google sheet sync logs"
on public.t_google_sheet_sync_log for select
to authenticated
using (public.is_admin());

drop policy if exists "admin can read admin limited role filters" on public.t_admin_limited_role_filter;
create policy "admin can read admin limited role filters"
on public.t_admin_limited_role_filter for select
to authenticated
using (public.is_admin());

drop policy if exists "admin can manage admin limited role filters" on public.t_admin_limited_role_filter;
create policy "admin can manage admin limited role filters"
on public.t_admin_limited_role_filter for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admin can read admin limited position filters" on public.t_admin_limited_position_filter;
create policy "admin can read admin limited position filters"
on public.t_admin_limited_position_filter for select
to authenticated
using (public.is_admin());

drop policy if exists "admin can manage admin limited position filters" on public.t_admin_limited_position_filter;
create policy "admin can manage admin limited position filters"
on public.t_admin_limited_position_filter for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admin can read app settings" on public.t_app_setting;
create policy "admin can read app settings"
on public.t_app_setting for select
to authenticated
using (public.is_admin());

drop policy if exists "admin can manage app settings" on public.t_app_setting;
create policy "admin can manage app settings"
on public.t_app_setting for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
