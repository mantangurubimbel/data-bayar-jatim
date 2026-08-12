import Link from "next/link";
import { redirect } from "next/navigation";
import { retrySheetSync, updateUserAccess } from "@/app/auth/actions";
import { BranchAccessDropdown } from "@/app/components/branch-access-dropdown";
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
    <main className="min-h-screen bg-[#f3f6fb] text-slate-900">
      <header className="sticky top-0 z-40 bg-[#2f6696] px-6 py-3 text-white shadow-sm sm:px-10">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-blue-100">Administrator</p>
            <h1 className="text-xl font-bold">Manajemen User & Branch Access</h1>
          </div>
          <Link
            className="inline-grid h-9 place-items-center rounded-md border border-white/25 px-4 text-sm font-bold text-white"
            href="/"
          >
            Dashboard
          </Link>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-4 px-6 py-6 sm:px-10">
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

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-4">
            <h2 className="text-2xl font-bold">Dashboard Admin</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Ringkasan operasional lintas branch.
            </p>
          </div>
          <div className="grid gap-4 p-4 lg:grid-cols-4">
            <div className="rounded-md border border-slate-200 p-4">
              <p className="text-xs font-bold uppercase text-slate-500">Total siswa</p>
              <p className="mt-2 text-3xl font-black text-slate-900">{formatNumber(totalStudents)}</p>
            </div>
            <div className="rounded-md border border-slate-200 p-4">
              <p className="text-xs font-bold uppercase text-slate-500">Data belum lengkap</p>
              <p className="mt-2 text-3xl font-black text-amber-600">
                {formatNumber(totalIncompleteStudents)}
              </p>
            </div>
            <div className="rounded-md border border-slate-200 p-4">
              <p className="text-xs font-bold uppercase text-slate-500">User terdaftar</p>
              <p className="mt-2 text-3xl font-black text-slate-900">{formatNumber(usersList.length)}</p>
            </div>
            <div className="rounded-md border border-slate-200 p-4">
              <p className="text-xs font-bold uppercase text-slate-500">Sync gagal terbaru</p>
              <p className="mt-2 text-3xl font-black text-red-600">{formatNumber(failedSyncCount)}</p>
            </div>
          </div>
          <div className="grid gap-4 border-t border-slate-200 p-4 xl:grid-cols-[1.4fr_1fr]">
            <div className="overflow-hidden rounded-md border border-slate-200">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                <h3 className="text-sm font-black text-slate-700">Siswa per Branch</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead className="bg-slate-100 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-black">Branch</th>
                      <th className="px-4 py-3 text-right font-black">Siswa</th>
                      <th className="px-4 py-3 text-right font-black">Belum lengkap</th>
                      <th className="px-4 py-3 text-right font-black">Tanpa rombel</th>
                      <th className="px-4 py-3 text-right font-black">User</th>
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
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                  <h3 className="text-sm font-black text-slate-700">Data Belum Lengkap Terbanyak</h3>
                </div>
                <div className="divide-y divide-slate-100">
                  {topIncompleteBranches.length > 0 ? (
                    topIncompleteBranches.map((branch) => (
                      <div className="flex items-center justify-between gap-3 px-4 py-3" key={branch.branch_id}>
                        <span className="truncate text-sm font-bold text-slate-700">{branch.branch_name}</span>
                        <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-700">
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
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                  <h3 className="text-sm font-black text-slate-700">Branch Belum Punya User</h3>
                </div>
                <div className="flex max-h-44 flex-wrap gap-2 overflow-y-auto p-4">
                  {branchesWithoutUsers.length > 0 ? (
                    branchesWithoutUsers.map((branch) => (
                      <span
                        className="rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-700"
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
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                <h3 className="text-sm font-black text-slate-700">Aktivitas Siswa Terbaru</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-slate-100 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-black">Waktu</th>
                      <th className="px-4 py-3 font-black">Siswa</th>
                      <th className="px-4 py-3 font-black">Branch</th>
                      <th className="px-4 py-3 font-black">Status</th>
                      <th className="px-4 py-3 font-black">Operator</th>
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

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-4">
            <h2 className="text-2xl font-bold">Audit & Sync</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Log aktivitas siswa dan status sinkronisasi Google Sheet.
            </p>
          </div>
          <div className="grid gap-4 p-4 xl:grid-cols-2">
            <div className="overflow-hidden rounded-md border border-slate-200">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                <h3 className="text-sm font-black text-slate-700">Aktivitas Data Siswa</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead className="bg-slate-100 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-black">Waktu</th>
                      <th className="px-4 py-3 font-black">Aksi</th>
                      <th className="px-4 py-3 font-black">Entitas</th>
                      <th className="px-4 py-3 font-black">Branch</th>
                      <th className="px-4 py-3 font-black">Perubahan</th>
                      <th className="px-4 py-3 font-black">Operator</th>
                    </tr>
                  </thead>
                  <tbody>
                    {((auditLogs ?? []) as StudentAuditLogRow[]).map((log) => (
                      <tr className="border-t border-slate-200" key={log.id}>
                        <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-600">
                          {formatDateTime(log.created_at)}
                        </td>
                        <td className="px-4 py-3 font-black uppercase text-slate-700">{log.action}</td>
                        <td className="px-4 py-3 font-semibold text-slate-700">
                          <p className="font-black uppercase">{log.entity_type}</p>
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
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                <h3 className="text-sm font-black text-slate-700">Status Sync Google Sheet</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-slate-100 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-black">Waktu</th>
                      <th className="px-4 py-3 font-black">NIS</th>
                      <th className="px-4 py-3 font-black">Aksi</th>
                      <th className="px-4 py-3 font-black">Status</th>
                      <th className="px-4 py-3 font-black">Pesan</th>
                      <th className="px-4 py-3 text-right font-black">Retry</th>
                    </tr>
                  </thead>
                  <tbody>
                    {syncLogRows.map((log) => (
                      <tr className="border-t border-slate-200" key={log.id}>
                        <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-600">
                          {formatDateTime(log.last_attempt_at)}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-700">{log.nis}</td>
                        <td className="px-4 py-3 font-black uppercase text-slate-700">{log.action}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-black ${
                              log.status === "failed"
                                ? "bg-red-50 text-red-700"
                                : log.status === "skipped"
                                  ? "bg-slate-100 text-slate-600"
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
                                className="inline-flex h-8 cursor-pointer items-center justify-center rounded-md bg-[#2f6696] px-3 text-xs font-black text-white disabled:cursor-wait disabled:opacity-80"
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

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-4">
            <h2 className="text-2xl font-bold">Daftar User</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Edit role dan cabang yang bisa diakses setiap user.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="w-[24%] px-4 py-3 font-bold">User</th>
                  <th className="w-[14%] px-4 py-3 font-bold">Posisi</th>
                  <th className="w-[12%] px-4 py-3 font-bold">Role</th>
                  <th className="px-4 py-3 font-bold">Branch Access</th>
                  <th className="w-[110px] px-4 py-3 text-right font-bold">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {usersList.map((appUser) => {
                  const userAccess = accessByUser.get(appUser.id) ?? new Set<number>();

                  return (
                    <tr className="border-t border-slate-200 align-top" key={appUser.id}>
                      <td className="px-4 py-3">
                        <form action={updateUserAccess} id={`user-access-${appUser.id}`} />
                        <input form={`user-access-${appUser.id}`} name="user_id" type="hidden" value={appUser.id} />
                        <label className="grid gap-1 text-xs font-bold text-slate-500">
                          Nama
                          <input
                            className="h-9 rounded-md border border-slate-200 px-3 text-sm font-normal text-slate-700 outline-none"
                            defaultValue={appUser.name ?? ""}
                            form={`user-access-${appUser.id}`}
                            name="name"
                          />
                        </label>
                        <p className="mt-2 truncate text-xs font-semibold text-slate-500">{appUser.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm text-slate-700 outline-none"
                          defaultValue={appUser.position ?? ""}
                          form={`user-access-${appUser.id}`}
                          name="position"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <select
                          className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none"
                          defaultValue={appUser.role_id}
                          form={`user-access-${appUser.id}`}
                          name="role_id"
                        >
                          {rolesList.map((role) => (
                            <option key={role.role_id} value={role.role_id}>
                              {role.role_name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <BranchAccessDropdown
                          branches={branchesList}
                          formId={`user-access-${appUser.id}`}
                          selectedBranchIds={[...userAccess]}
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <SubmitButton
                          className="inline-flex h-9 cursor-pointer items-center justify-center rounded-md bg-[#2f6696] px-4 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-80"
                          form={`user-access-${appUser.id}`}
                          pendingText="Menyimpan"
                        >
                          Simpan
                        </SubmitButton>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
