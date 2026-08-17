import Link from "next/link";
import { Activity, Building2, LayoutDashboard, Users } from "lucide-react";
import { redirect } from "next/navigation";
import { retrySheetSync, updateUserAccess } from "@/app/auth/actions";
import { BranchAccessDropdown } from "@/app/components/branch-access-dropdown";
import { buttonStyles } from "@/app/components/button-styles";
import { GeneratePasswordButton } from "@/app/components/generate-password-button";
import { SubmitButton } from "@/app/components/submit-button";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server";

type UserRow = {
  id: string;
  name: string | null;
  email: string | null;
  position: string | null;
  role_id: string;
};

type RoleRow = {
  role_id: string;
  role_name: string;
};

type BranchRow = {
  branch_id: number;
  branch_name: string;
};

type UserBranchRow = {
  user_id: string;
  branch_id: number;
};

type DashboardSummaryRow = {
  branch_id: number;
  branch_name: string | null;
  active_students: number | null;
  incomplete_students: number | null;
  students_without_rombel: number | null;
};

type RecentStudentActivityRow = {
  nis: string;
  user_name: string | null;
  branch_name: string | null;
  status: string | null;
  operator_email: string | null;
  updated_at: string | null;
};

type StudentAuditLogRow = {
  id: number;
  entity_type: string;
  entity_id: string | null;
  action: string;
  branch_id: number | null;
  destination_branch_id: number | null;
  actor_email: string | null;
  detail: {
    changed_fields?: Record<string, { before: string | number | null; after: string | number | null }>;
  } | null;
  created_at: string | null;
};

type SheetSyncLogRow = {
  id: number;
  nis: string;
  action: string;
  status: string;
  actor_email: string | null;
  attempts: number | null;
  error_message: string | null;
  last_attempt_at: string | null;
};

type BranchDashboardMetric = {
  branch_id: number;
  branch_name: string;
  total_students: number;
  incomplete_students: number;
  students_without_rombel: number;
  user_count: number;
};

const numberFormatter = new Intl.NumberFormat("id-ID");

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatChangedFields(
  changedFields?: Record<string, { before: string | number | null; after: string | number | null }>,
) {
  const entries = Object.entries(changedFields ?? {}).slice(0, 3);

  if (entries.length === 0) {
    return "-";
  }

  return entries
    .map(([field, values]) => `${field}: ${values.before ?? "kosong"} -> ${values.after ?? "kosong"}`)
    .join(", ");
}

export default async function AdministratorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const dataSupabase = createSupabaseServiceRoleClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: currentProfile } = await dataSupabase
    .from("t_app_user")
    .select("role_id")
    .eq("id", user.id)
    .maybeSingle();

  if (currentProfile?.role_id !== "admin") {
    redirect("/");
  }

  const [
    { data: users },
    { data: roles },
    { data: branches },
    { data: userBranches },
    { data: dashboardSummary },
    { data: recentStudentActivities },
    { data: auditLogs },
    { data: syncLogs },
  ] = await Promise.all([
    dataSupabase
      .from("t_app_user")
      .select("id, name, email, position, role_id")
      .order("email"),
    dataSupabase.from("t_role").select("role_id, role_name").order("role_name"),
    dataSupabase
      .from("t_branch")
      .select("branch_id, branch_name")
      .neq("branch_id", 100)
      .order("branch_name"),
    dataSupabase.from("t_app_user_branch").select("user_id, branch_id"),
    dataSupabase
      .from("v_dashboard_summary")
      .select("branch_id, branch_name, active_students, incomplete_students, students_without_rombel"),
    dataSupabase
      .from("v_student_detail")
      .select("nis, user_name, branch_name, status, operator_email, updated_at")
      .order("updated_at", { ascending: false })
      .limit(8),
    dataSupabase
      .from("t_admin_audit_log")
      .select("id, entity_type, entity_id, action, branch_id, destination_branch_id, actor_email, detail, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
    dataSupabase
      .from("t_google_sheet_sync_log")
      .select("id, nis, action, status, actor_email, attempts, error_message, last_attempt_at")
      .order("last_attempt_at", { ascending: false })
      .limit(10),
  ]);

  const usersList = (users ?? []) as UserRow[];
  const rolesList = (roles ?? []) as RoleRow[];
  const branchesList = (branches ?? []) as BranchRow[];
  const accessByUser = new Map<string, Set<number>>();
  const userCountByBranch = new Map<number, number>();

  ((userBranches ?? []) as UserBranchRow[]).forEach((row) => {
    const access = accessByUser.get(row.user_id) ?? new Set<number>();
    access.add(row.branch_id);
    accessByUser.set(row.user_id, access);
    userCountByBranch.set(row.branch_id, (userCountByBranch.get(row.branch_id) ?? 0) + 1);
  });

  const metricsByBranch = new Map<number, BranchDashboardMetric>();
  branchesList.forEach((branch) => {
    metricsByBranch.set(branch.branch_id, {
      branch_id: branch.branch_id,
      branch_name: branch.branch_name,
      total_students: 0,
      incomplete_students: 0,
      students_without_rombel: 0,
      user_count: userCountByBranch.get(branch.branch_id) ?? 0,
    });
  });
  ((dashboardSummary ?? []) as DashboardSummaryRow[]).forEach((row) => {
    const metric =
      metricsByBranch.get(row.branch_id) ??
      ({
        branch_id: row.branch_id,
        branch_name: row.branch_name ?? `Branch ${row.branch_id}`,
        total_students: 0,
        incomplete_students: 0,
        students_without_rombel: 0,
        user_count: userCountByBranch.get(row.branch_id) ?? 0,
      } satisfies BranchDashboardMetric);

    metric.total_students += row.active_students ?? 0;
    metric.incomplete_students += row.incomplete_students ?? 0;
    metric.students_without_rombel += row.students_without_rombel ?? 0;
    metricsByBranch.set(row.branch_id, metric);
  });

  const branchMetrics = [...metricsByBranch.values()].sort(
    (first, second) => second.total_students - first.total_students,
  );
  const branchesWithoutUsers = branchMetrics.filter((branch) => branch.user_count === 0);
  const totalStudents = branchMetrics.reduce((total, branch) => total + branch.total_students, 0);
  const totalIncompleteStudents = branchMetrics.reduce(
    (total, branch) => total + branch.incomplete_students,
    0,
  );
  const topIncompleteBranches = [...branchMetrics]
    .filter((branch) => branch.incomplete_students > 0)
    .sort((first, second) => second.incomplete_students - first.incomplete_students)
    .slice(0, 5);
  const syncLogRows = (syncLogs ?? []) as SheetSyncLogRow[];
  const failedSyncCount = syncLogRows.filter((log) => log.status === "failed").length;

  return (
    <main className="min-h-screen bg-[#f8fafc] font-[Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,Segoe_UI,sans-serif] text-[14px] text-slate-900 lg:grid lg:grid-cols-[208px_minmax(0,1fr)]">
      <aside className="hidden bg-[#171717] text-white lg:flex lg:min-h-screen lg:flex-col">
        <div className="px-4 py-5">
          <h1 className="text-[20px] font-bold tracking-tight">Data Bayar</h1>
          <p className="mt-1 text-[13px] font-semibold text-white/55">Admin Console</p>
        </div>
        <nav className="grid gap-1 border-t border-white/5 px-2 py-4 text-[14px] font-bold text-white/80">
          <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-white/35">Main</p>
          <Link className="flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-white/10" href="/">
            <LayoutDashboard className="size-4" aria-hidden="true" />
            Dashboard
          </Link>
          <Link className="flex items-center gap-3 rounded-md bg-[#2b2b2b] px-3 py-2.5 text-white ring-1 ring-white/5" href="#admin-overview">
            <LayoutDashboard className="size-4" aria-hidden="true" />
            Overview
          </Link>
          <p className="px-3 pb-2 pt-4 text-[11px] font-bold uppercase tracking-[0.16em] text-white/35">Management</p>
          <Link className="flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-white/10" href="#admin-operations">
            <Building2 className="size-4" aria-hidden="true" />
            Operasional
          </Link>
          <Link className="flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-white/10" href="#admin-logs">
            <Activity className="size-4" aria-hidden="true" />
            Log
          </Link>
          <Link className="flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-white/10" href="#admin-users">
            <Users className="size-4" aria-hidden="true" />
            User
          </Link>
        </nav>
        <div className="mt-auto border-t border-white/5 px-4 py-5 text-sm">
          <p className="font-bold">Administrator</p>
          <p className="mt-1 text-xs font-semibold text-white/50">Manajemen akses</p>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-40 border-b border-slate-200 bg-white px-5 py-4 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[12px] font-bold uppercase tracking-[0.24em] text-[#316bff]">Administrator</p>
              <h1 className="mt-1.5 text-[24px] font-bold leading-tight tracking-tight text-slate-950">
                Manajemen User & Branch Access
              </h1>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                Monitor operasional, sinkronisasi, dan akses user.
              </p>
            </div>
            <Link className={buttonStyles.secondary} href="/">
              Dashboard
            </Link>
          </div>
        </header>

      <div className="grid w-full gap-4 px-5 py-5 lg:px-8">
        {params.error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {params.error}
          </div>
        )}
        {params.success === "1" && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            Akses user berhasil diperbarui.
          </div>
        )}
        {params.success === "sync-retry" && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            Retry sync Google Sheet sudah diproses.
          </div>
        )}

          <div className="grid min-w-0 gap-4">
        <section id="admin-overview" className="scroll-mt-24 rounded-md border border-slate-200 bg-white ">
          <div className="border-b border-slate-200 p-4">
            <h2 className="text-xl font-bold">Dashboard Admin</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Ringkasan operasional lintas branch.
            </p>
          </div>
          <div className="grid gap-4 p-4 lg:grid-cols-4">
            <div className="rounded-md border border-slate-200 p-4">
              <p className="text-xs font-bold uppercase text-slate-500">Total siswa</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{formatNumber(totalStudents)}</p>
            </div>
            <div className="rounded-md border border-slate-200 p-4">
              <p className="text-xs font-bold uppercase text-slate-500">Data belum lengkap</p>
              <p className="mt-2 text-2xl font-bold text-amber-600">
                {formatNumber(totalIncompleteStudents)}
              </p>
            </div>
            <div className="rounded-md border border-slate-200 p-4">
              <p className="text-xs font-bold uppercase text-slate-500">User terdaftar</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{formatNumber(usersList.length)}</p>
            </div>
            <div className="rounded-md border border-slate-200 p-4">
              <p className="text-xs font-bold uppercase text-slate-500">Sync gagal terbaru</p>
              <p className="mt-2 text-2xl font-bold text-red-600">{formatNumber(failedSyncCount)}</p>
            </div>
          </div>
          <div id="admin-operations" className="grid scroll-mt-24 gap-4 border-t border-slate-200 p-4 xl:grid-cols-[1.4fr_1fr]">
            <div className="overflow-hidden rounded-md border border-slate-200">
              <div className="border-b border-slate-200 bg-white px-4 py-3">
                <h3 className="text-sm font-bold text-slate-700">Siswa per Branch</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-bold">Branch</th>
                      <th className="px-4 py-3 text-right font-bold">Siswa</th>
                      <th className="px-4 py-3 text-right font-bold">Belum lengkap</th>
                      <th className="px-4 py-3 text-right font-bold">Tanpa rombel</th>
                      <th className="px-4 py-3 text-right font-bold">User</th>
                    </tr>
                  </thead>
                  <tbody>
                    {branchMetrics.map((branch) => (
                      <tr className="border-t border-slate-200" key={branch.branch_id}>
                        <td className="px-4 py-3 font-bold text-slate-700">{branch.branch_name}</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-700">
                          {formatNumber(branch.total_students)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-amber-700">
                          {formatNumber(branch.incomplete_students)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-700">
                          {formatNumber(branch.students_without_rombel)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-700">
                          {formatNumber(branch.user_count)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="grid gap-4">
              <div className="rounded-md border border-slate-200">
                <div className="border-b border-slate-200 bg-white px-4 py-3">
                  <h3 className="text-sm font-bold text-slate-700">Data Belum Lengkap Terbanyak</h3>
                </div>
                <div className="divide-y divide-slate-100">
                  {topIncompleteBranches.length > 0 ? (
                    topIncompleteBranches.map((branch) => (
                      <div className="flex items-center justify-between gap-3 px-4 py-3" key={branch.branch_id}>
                        <span className="truncate text-sm font-bold text-slate-700">{branch.branch_name}</span>
                        <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
                          {formatNumber(branch.incomplete_students)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="px-4 py-5 text-sm font-semibold text-slate-500">Semua data siswa lengkap.</p>
                  )}
                </div>
              </div>
              <div className="rounded-md border border-slate-200">
                <div className="border-b border-slate-200 bg-white px-4 py-3">
                  <h3 className="text-sm font-bold text-slate-700">Branch Belum Punya User</h3>
                </div>
                <div className="flex max-h-44 flex-wrap gap-2 overflow-y-auto p-4">
                  {branchesWithoutUsers.length > 0 ? (
                    branchesWithoutUsers.map((branch) => (
                      <span
                        className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700"
                        key={branch.branch_id}
                      >
                        {branch.branch_name}
                      </span>
                    ))
                  ) : (
                    <p className="text-sm font-semibold text-slate-500">Semua branch sudah punya user.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="border-t border-slate-200 p-4">
            <div className="overflow-hidden rounded-md border border-slate-200">
              <div className="border-b border-slate-200 bg-white px-4 py-3">
                <h3 className="text-sm font-bold text-slate-700">Aktivitas Siswa Terbaru</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-bold">Waktu</th>
                      <th className="px-4 py-3 font-bold">Siswa</th>
                      <th className="px-4 py-3 font-bold">Branch</th>
                      <th className="px-4 py-3 font-bold">Status</th>
                      <th className="px-4 py-3 font-bold">Operator</th>
                    </tr>
                  </thead>
                  <tbody>
                    {((recentStudentActivities ?? []) as RecentStudentActivityRow[]).map((activity) => (
                      <tr className="border-t border-slate-200" key={activity.nis}>
                        <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-600">
                          {formatDateTime(activity.updated_at)}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-700">{activity.user_name ?? "-"}</p>
                          <p className="text-xs font-semibold text-slate-500">{activity.nis}</p>
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-700">
                          {activity.branch_name ?? "-"}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-700">{activity.status ?? "-"}</td>
                        <td className="px-4 py-3 font-semibold text-slate-600">
                          {activity.operator_email ?? "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        <section id="admin-logs" className="scroll-mt-24 rounded-md border border-slate-200 bg-white ">
          <div className="border-b border-slate-200 p-4">
            <h2 className="text-xl font-bold">Audit & Sync</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Log aktivitas siswa dan status sinkronisasi Google Sheet.
            </p>
          </div>
          <div className="grid gap-4 p-4 xl:grid-cols-2">
            <div className="overflow-hidden rounded-md border border-slate-200">
              <div className="border-b border-slate-200 bg-white px-4 py-3">
                <h3 className="text-sm font-bold text-slate-700">Aktivitas Data Siswa</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-bold">Waktu</th>
                      <th className="px-4 py-3 font-bold">Aksi</th>
                      <th className="px-4 py-3 font-bold">Entitas</th>
                      <th className="px-4 py-3 font-bold">Branch</th>
                      <th className="px-4 py-3 font-bold">Perubahan</th>
                      <th className="px-4 py-3 font-bold">Operator</th>
                    </tr>
                  </thead>
                  <tbody>
                    {((auditLogs ?? []) as StudentAuditLogRow[]).map((log) => (
                      <tr className="border-t border-slate-200" key={log.id}>
                        <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-600">
                          {formatDateTime(log.created_at)}
                        </td>
                        <td className="px-4 py-3 font-bold uppercase text-slate-700">{log.action}</td>
                        <td className="px-4 py-3 font-semibold text-slate-700">
                          <p className="font-bold uppercase">{log.entity_type}</p>
                          <p className="text-xs text-slate-500">{log.entity_id ?? "-"}</p>
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-700">
                          {log.destination_branch_id
                            ? `${log.branch_id ?? "-"} -> ${log.destination_branch_id}`
                            : (log.branch_id ?? "-")}
                        </td>
                        <td
                          className="max-w-72 truncate px-4 py-3 font-semibold text-slate-600"
                          title={formatChangedFields(log.detail?.changed_fields)}
                        >
                          {formatChangedFields(log.detail?.changed_fields)}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-600">{log.actor_email ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="overflow-hidden rounded-md border border-slate-200">
              <div className="border-b border-slate-200 bg-white px-4 py-3">
                <h3 className="text-sm font-bold text-slate-700">Status Sync Google Sheet</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-bold">Waktu</th>
                      <th className="px-4 py-3 font-bold">NIS</th>
                      <th className="px-4 py-3 font-bold">Aksi</th>
                      <th className="px-4 py-3 font-bold">Status</th>
                      <th className="px-4 py-3 font-bold">Pesan</th>
                      <th className="px-4 py-3 text-right font-bold">Retry</th>
                    </tr>
                  </thead>
                  <tbody>
                    {syncLogRows.map((log) => (
                      <tr className="border-t border-slate-200" key={log.id}>
                        <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-600">
                          {formatDateTime(log.last_attempt_at)}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-700">{log.nis}</td>
                        <td className="px-4 py-3 font-bold uppercase text-slate-700">{log.action}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                              log.status === "failed"
                                ? "bg-red-50 text-red-700"
                                : log.status === "skipped"
                                  ? "bg-slate-50 text-slate-600"
                                  : "bg-emerald-50 text-emerald-700"
                            }`}
                          >
                            {log.status}
                          </span>
                        </td>
                        <td
                          className="max-w-52 truncate px-4 py-3 font-semibold text-slate-600"
                          title={log.error_message ?? ""}
                        >
                          {log.error_message ?? "-"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {log.status === "failed" ? (
                            <form action={retrySheetSync}>
                              <input name="nis" type="hidden" value={log.nis} />
                              <input name="sync_action" type="hidden" value={log.action} />
                              <SubmitButton
                                className={buttonStyles.primarySmall}
                                pendingText="Retry"
                              >
                                Retry
                              </SubmitButton>
                            </form>
                          ) : (
                            <span className="text-xs font-semibold text-slate-400">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        <section id="admin-users" className="scroll-mt-24 overflow-hidden rounded-md border border-slate-200 bg-white ">
          <div className="border-b border-slate-200 p-4">
            <h2 className="text-xl font-bold">Daftar User</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Edit role dan cabang yang bisa diakses setiap user.
            </p>
          </div>
          <div className="grid gap-2 p-4">
            {usersList.map((appUser) => {
              const userAccess = accessByUser.get(appUser.id) ?? new Set<number>();
              const selectedBranchCount = userAccess.size;
              const roleLabel =
                rolesList.find((role) => role.role_id === appUser.role_id)?.role_name ?? appUser.role_id;

              return (
                <details className="group rounded-md border border-slate-200 bg-white" key={appUser.id}>
                  <summary className="grid cursor-pointer list-none gap-3 px-4 py-3 hover:bg-white sm:grid-cols-[minmax(0,1fr)_130px_130px_90px] sm:items-center [&::-webkit-details-marker]:hidden">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-800">{appUser.name ?? appUser.email}</p>
                      <p className="mt-1 truncate text-xs font-semibold text-slate-500">{appUser.email}</p>
                    </div>
                    <span className="rounded-full bg-slate-50 px-2.5 py-1 text-center text-xs font-bold text-slate-600">
                      {roleLabel}
                    </span>
                    <span className="rounded-full bg-[#e8f1f8] px-2.5 py-1 text-center text-xs font-bold text-[#2f6696]">
                      {selectedBranchCount} branch
                    </span>
                    <span className="text-right text-xs font-bold text-[#2f6696] group-open:text-slate-500">
                      Edit
                    </span>
                  </summary>

                  <form action={updateUserAccess} className="grid gap-4 border-t border-slate-200 bg-white p-4">
                    <input name="user_id" type="hidden" value={appUser.id} />
                    <div className="grid gap-4 lg:grid-cols-[1fr_220px_180px]">
                      <label className="grid gap-1 text-xs font-bold text-slate-500">
                        Nama
                        <input
                          className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-normal text-slate-700 outline-none"
                          defaultValue={appUser.name ?? ""}
                          name="name"
                        />
                      </label>
                      <label className="grid gap-1 text-xs font-bold text-slate-500">
                        Posisi
                        <input
                          className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none"
                          defaultValue={appUser.position ?? ""}
                          name="position"
                        />
                      </label>
                      <label className="grid gap-1 text-xs font-bold text-slate-500">
                        Role
                        <select
                          className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none"
                          defaultValue={appUser.role_id}
                          name="role_id"
                        >
                          {rolesList.map((role) => (
                            <option key={role.role_id} value={role.role_id}>
                              {role.role_name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px] lg:items-start">
                      <div>
                        <p className="mb-1 text-xs font-bold text-slate-500">Branch Access</p>
                        <BranchAccessDropdown
                          branches={branchesList}
                          formId={`user-access-${appUser.id}`}
                          selectedBranchIds={[...userAccess]}
                        />
                      </div>
                      <div className="flex flex-wrap justify-end gap-2 lg:flex-col lg:items-end">
                        <SubmitButton className={buttonStyles.primary} pendingText="Menyimpan">
                          Simpan
                        </SubmitButton>
                        <GeneratePasswordButton userId={appUser.id} />
                      </div>
                    </div>
                  </form>
                </details>
              );
            })}
          </div>
        </section>
          </div>
        </div>
      </div>
    </main>
  );
}
