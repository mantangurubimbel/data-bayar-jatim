import {
  type AcademicYearRow,
  type BranchDashboardMetric,
  type BranchRow,
  type DashboardSummaryRow,
  type SheetSyncLogRow,
  type UserBranchRow,
  isFullAdminRole,
  formatNumber,
  getBranchMetrics,
  requireAdminContext,
} from "@/app/administrator/admin-utils";
import { AcademicYearFilter } from "@/app/administrator/academic-year-filter";
import { PageHeader } from "@/app/administrator/page-header";

export default async function AdministratorPage({
  searchParams,
}: {
  searchParams: Promise<{ academic_year?: string }>;
}) {
  const params = await searchParams;
  const { dataSupabase, profile } = await requireAdminContext();
  const isFullAdmin = isFullAdminRole(profile.role_id);
  const { data: actorBranches } = isFullAdmin
    ? { data: null }
    : await dataSupabase.from("t_app_user_branch").select("branch_id").eq("user_id", profile.id);
  const accessibleBranchIds = new Set((actorBranches ?? []).map((row) => row.branch_id));
  const [{ data: academicYears }, { data: branches }, { data: dashboardSummary }, { data: userBranches }, { data: syncLogs }] =
    await Promise.all([
      dataSupabase
        .from("t_academic_year")
        .select("academic_year, is_active")
        .order("academic_year", { ascending: false }),
      dataSupabase
        .from("t_branch")
        .select("branch_id, branch_name")
        .order("branch_name"),
      dataSupabase
        .from("v_dashboard_summary")
        .select(
          "branch_id, branch_name, academic_year, active_students, incomplete_students, students_without_rombel",
        ),
      dataSupabase.from("t_app_user_branch").select("user_id, branch_id"),
      dataSupabase
        .from("t_google_sheet_sync_log")
        .select("id, nis, action, status, actor_email, attempts, error_message, last_attempt_at")
        .order("last_attempt_at", { ascending: false })
        .limit(10),
    ]);

  const academicYearList = (academicYears ?? []) as AcademicYearRow[];
  const selectedAcademicYear =
    academicYearList.find((academicYear) => academicYear.academic_year === params.academic_year)?.academic_year ??
    academicYearList.find((academicYear) => academicYear.is_active)?.academic_year ??
    academicYearList[0]?.academic_year ??
    "";
  const scopedBranches = ((branches ?? []) as BranchRow[]).filter(
    (branch) => isFullAdmin || (branch.branch_id !== 100 && accessibleBranchIds.has(branch.branch_id)),
  );
  const scopedDashboardSummary = ((dashboardSummary ?? []) as DashboardSummaryRow[]).filter(
    (row) =>
      row.academic_year === selectedAcademicYear &&
      (isFullAdmin || accessibleBranchIds.has(row.branch_id)),
  );
  const branchMetrics = getBranchMetrics({
    branches: scopedBranches,
    dashboardSummary: scopedDashboardSummary,
    userBranches: (userBranches ?? []) as UserBranchRow[],
  });
  const totalStudents = branchMetrics.reduce((sum, branch) => sum + branch.total_students, 0);
  const totalIncompleteStudents = branchMetrics.reduce((sum, branch) => sum + branch.incomplete_students, 0);
  const failedSyncCount = isFullAdmin
    ? ((syncLogs ?? []) as SheetSyncLogRow[]).filter((log) => log.status === "failed").length
    : 0;
  const branchesWithoutUsers = branchMetrics.filter((branch) => branch.user_count === 0);
  const topIncompleteBranches = [...branchMetrics]
    .filter((branch) => branch.incomplete_students > 0)
    .sort((first, second) => second.incomplete_students - first.incomplete_students)
    .slice(0, 5);

  return (
    <>
      <PageHeader description="Ringkasan operasional lintas branch." title="Dashboard Admin" />
      <section className="rounded-md border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-bold">Overview</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">Ringkasan cepat kondisi data dan sinkronisasi.</p>
          </div>
          <AcademicYearFilter academicYears={academicYearList} selectedAcademicYear={selectedAcademicYear} />
        </div>
        <div className="grid gap-4 p-4 lg:grid-cols-4">
          <MetricCard label="Total siswa" value={totalStudents} />
          <MetricCard label="Data belum lengkap" value={totalIncompleteStudents} tone="amber" />
          <MetricCard label="Branch tanpa user" value={branchesWithoutUsers.length} />
          <MetricCard label="Sync gagal terbaru" value={failedSyncCount} tone="red" />
        </div>
      </section>

      <section className="rounded-md border border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-4">
          <h2 className="text-xl font-bold">Branch Perlu Perhatian</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">Cabang tanpa user dan data belum lengkap tertinggi.</p>
        </div>
        <div className="grid gap-4 p-4 xl:grid-cols-2">
          <BranchList
            emptyText="Semua branch sudah punya user."
            items={branchesWithoutUsers}
            label="Branch Tanpa User"
            valueKey="user_count"
          />
          <BranchList
            emptyText="Semua data siswa lengkap."
            items={topIncompleteBranches}
            label="Data Belum Lengkap Terbanyak"
            valueKey="incomplete_students"
          />
        </div>
      </section>
    </>
  );
}

function MetricCard({
  label,
  tone = "slate",
  value,
}: {
  label: string;
  tone?: "amber" | "red" | "slate";
  value: number;
}) {
  const valueClass =
    tone === "amber" ? "text-amber-600" : tone === "red" ? "text-red-600" : "text-slate-900";

  return (
    <div className="rounded-md border border-slate-200 p-4">
      <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${valueClass}`}>{formatNumber(value)}</p>
    </div>
  );
}

function BranchList({
  emptyText,
  items,
  label,
  valueKey,
}: {
  emptyText: string;
  items: BranchDashboardMetric[];
  label: string;
  valueKey: keyof Pick<BranchDashboardMetric, "incomplete_students" | "user_count">;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-slate-200">
      <div className="border-b border-slate-200 bg-white px-4 py-3">
        <h3 className="text-sm font-bold text-slate-700">{label}</h3>
      </div>
      <div className="divide-y divide-slate-100">
        {items.length > 0 ? (
          items.map((branch) => (
            <div className="flex items-center justify-between gap-3 px-4 py-3" key={branch.branch_id}>
              <span className="truncate text-sm font-bold text-slate-700">{branch.branch_name}</span>
              <span className="shrink-0 rounded-full bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-600">
                {formatNumber(branch[valueKey])}
              </span>
            </div>
          ))
        ) : (
          <p className="px-4 py-5 text-sm font-semibold text-slate-500">{emptyText}</p>
        )}
      </div>
    </div>
  );
}
