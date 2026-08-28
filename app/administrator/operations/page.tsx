import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import {
  type AcademicYearRow,
  type BranchDashboardMetric,
  type BranchRow,
  type RecentStudentActivityRow,
  type UserBranchRow,
  isFullAdminRole,
  formatDateTime,
  formatNumber,
  requireAdminContext,
} from "@/app/administrator/admin-utils";
import { AcademicYearFilter } from "@/app/administrator/academic-year-filter";
import { PageHeader } from "@/app/administrator/page-header";

type OperationStudentRow = {
  agent_id: number | null;
  birth_date: string | null;
  branch_id: number | null;
  email: string | null;
  npsn: string | null;
  parents_name: string | null;
  parents_phone: string | null;
  payment_id: number | null;
  rombel_id: number | null;
  status: string | null;
  user_serial: string | null;
};

type OperationRombelRow = {
  branch_id: number | null;
  rombel_id: number;
};

type OperationBranchMetric = BranchDashboardMetric & {
  active_rombels: number;
  all_year_loyal_students: number;
  avg_students_per_rombel: string;
  avg_students_per_rombel_value: number;
  loyal_students: string;
  previous_year_loyal_students: number;
  renewal_rate: string;
  renewal_rate_value: number;
};

type BranchSortKey =
  | "active_rombels"
  | "avg_students_per_rombel"
  | "branch"
  | "incomplete_students"
  | "renewal_rate"
  | "students"
  | "students_loyal";

type SortDirection = "asc" | "desc";

function previousAcademicYear(academicYear: string) {
  const match = academicYear.match(/^(\d{2,4})\/(\d{2,4})$/);
  if (!match) {
    return null;
  }
  const [, startYear, endYear] = match;
  const previousStart = String(Number(startYear) - 1).padStart(startYear.length, "0");
  const previousEnd = String(Number(endYear) - 1).padStart(endYear.length, "0");
  return `${previousStart}/${previousEnd}`;
}

function formatRate(count: number, total: number) {
  return total > 0 ? `${((count / total) * 100).toFixed(0)}%` : "0%";
}

function isFilled(value: string | null) {
  return Boolean(value?.trim());
}

function isBranchSortKey(value: string | undefined): value is BranchSortKey {
  return (
    value === "active_rombels" ||
    value === "avg_students_per_rombel" ||
    value === "branch" ||
    value === "incomplete_students" ||
    value === "renewal_rate" ||
    value === "students" ||
    value === "students_loyal"
  );
}

function isSortDirection(value: string | undefined): value is SortDirection {
  return value === "asc" || value === "desc";
}

function compareNumber(first: number, second: number) {
  return first - second;
}

const operationsFetchPageSize = 1000;
const serialLookupChunkSize = 500;

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

async function fetchAllRows<T>(queryPage: (from: number, to: number) => PromiseLike<{ data: T[] | null }>) {
  const rows: T[] = [];
  let from = 0;

  while (true) {
    const { data } = await queryPage(from, from + operationsFetchPageSize - 1);
    const pageRows = data ?? [];
    rows.push(...pageRows);

    if (pageRows.length < operationsFetchPageSize) {
      return rows;
    }

    from += operationsFetchPageSize;
  }
}

export default async function AdminOperationsPage({
  searchParams,
}: {
  searchParams: Promise<{ academic_year?: string; direction?: string; sort?: string }>;
}) {
  const params = await searchParams;
  const { dataSupabase, profile } = await requireAdminContext();
  const isFullAdmin = isFullAdminRole(profile.role_id);
  const { data: actorBranches } = isFullAdmin
    ? { data: null }
    : await dataSupabase.from("t_app_user_branch").select("branch_id").eq("user_id", profile.id);
  const accessibleBranchIds = new Set((actorBranches ?? []).map((row) => row.branch_id));
  const [
    { data: academicYears },
    { data: branches },
    { data: userBranches },
    { data: recentStudentActivities },
  ] = await Promise.all([
      dataSupabase
        .from("t_academic_year")
        .select("academic_year, is_active")
        .order("academic_year", { ascending: false }),
      dataSupabase
        .from("t_branch")
        .select("branch_id, branch_name")
        .order("branch_name"),
      dataSupabase.from("t_app_user_branch").select("user_id, branch_id"),
      dataSupabase
        .from("v_student_detail")
        .select("nis, user_name, branch_id, branch_name, academic_year, status, operator_email, updated_at")
        .order("updated_at", { ascending: false })
        .limit(8),
    ]);
  const academicYearList = (academicYears ?? []) as AcademicYearRow[];
  const selectedAcademicYear =
    academicYearList.find((academicYear) => academicYear.academic_year === params.academic_year)?.academic_year ??
    academicYearList.find((academicYear) => academicYear.is_active)?.academic_year ??
    academicYearList[0]?.academic_year ??
    "";
  const sortKey = isBranchSortKey(params.sort) ? params.sort : "branch";
  const sortDirection = isSortDirection(params.direction) ? params.direction : "asc";
  const scopedBranches = ((branches ?? []) as BranchRow[]).filter(
    (branch) => isFullAdmin || (branch.branch_id !== 100 && accessibleBranchIds.has(branch.branch_id)),
  );
  const scopedRecentStudentActivities = ((recentStudentActivities ?? []) as RecentStudentActivityRow[]).filter(
    (activity) =>
      activity.academic_year === selectedAcademicYear &&
      (isFullAdmin || (activity.branch_id !== null && accessibleBranchIds.has(activity.branch_id))),
  );
  const previousYear = previousAcademicYear(selectedAcademicYear);
  const scopedBranchIds = scopedBranches.map((branch) => branch.branch_id);
  const [selectedYearStudents, rombels] =
    scopedBranchIds.length > 0
      ? await Promise.all([
          fetchAllRows<OperationStudentRow>((from, to) =>
            dataSupabase
              .from("t_students")
              .select(
                "branch_id, user_serial, birth_date, email, npsn, rombel_id, parents_name, parents_phone, agent_id, payment_id, status",
              )
              .in("branch_id", scopedBranchIds)
              .eq("academic_year", selectedAcademicYear)
              .neq("status", "Deleted")
              .range(from, to),
          ),
          fetchAllRows<OperationRombelRow>((from, to) =>
            dataSupabase
              .from("t_rombel")
              .select("branch_id, rombel_id")
              .in("branch_id", scopedBranchIds)
              .eq("academic_year", selectedAcademicYear)
              .range(from, to),
          ),
        ])
      : [[], []];
  const selectedYearSerials = [
    ...new Set(
      selectedYearStudents
        .map((student) => student.user_serial?.trim())
        .filter((serial): serial is string => Boolean(serial)),
    ),
  ];
  const [repeatPurchaseRows, previousYearRows] =
    selectedYearSerials.length > 0
      ? await Promise.all([
          Promise.all(
            chunkArray(selectedYearSerials, serialLookupChunkSize).map((serials) =>
              fetchAllRows<Pick<OperationStudentRow, "user_serial">>((from, to) =>
                dataSupabase
                  .from("t_students")
                  .select("user_serial")
                  .in("user_serial", serials)
                  .neq("academic_year", selectedAcademicYear)
                  .neq("status", "Deleted")
                  .range(from, to),
              ),
            ),
          ).then((rows) => rows.flat()),
          previousYear
            ? Promise.all(
                chunkArray(selectedYearSerials, serialLookupChunkSize).map((serials) =>
                  fetchAllRows<Pick<OperationStudentRow, "user_serial">>((from, to) =>
                    dataSupabase
                      .from("t_students")
                      .select("user_serial")
                      .in("user_serial", serials)
                      .eq("academic_year", previousYear)
                      .neq("status", "Deleted")
                      .range(from, to),
                  ),
                ),
              ).then((rows) => rows.flat())
            : Promise.resolve([]),
        ])
      : [[], []];
  const selectedStudentsByBranch = new Map<number, OperationStudentRow[]>();
  selectedYearStudents.forEach((student) => {
    if (typeof student.branch_id !== "number") {
      return;
    }
    const branchStudents = selectedStudentsByBranch.get(student.branch_id) ?? [];
    branchStudents.push(student);
    selectedStudentsByBranch.set(student.branch_id, branchStudents);
  });
  const repeatSerials = new Set(
    repeatPurchaseRows
      .map((student) => student.user_serial?.trim())
      .filter((serial): serial is string => Boolean(serial)),
  );
  const previousYearSerials = new Set(
    previousYearRows
      .map((student) => student.user_serial?.trim())
      .filter((serial): serial is string => Boolean(serial)),
  );
  const rombelsByBranch = new Map<number, OperationRombelRow[]>();
  rombels.forEach((rombel) => {
    if (typeof rombel.branch_id !== "number") {
      return;
    }
    const branchRombels = rombelsByBranch.get(rombel.branch_id) ?? [];
    branchRombels.push(rombel);
    rombelsByBranch.set(rombel.branch_id, branchRombels);
  });
  const userCountByBranch = new Map<number, number>();
  ((userBranches ?? []) as UserBranchRow[]).forEach((row) => {
    userCountByBranch.set(row.branch_id, (userCountByBranch.get(row.branch_id) ?? 0) + 1);
  });
  const branchMetrics: OperationBranchMetric[] = scopedBranches
    .map((branch) => {
      const activeStudents = selectedStudentsByBranch.get(branch.branch_id) ?? [];
      const activeStatusStudents = activeStudents.filter((student) => student.status === "Active");
      const allYearLoyalStudents = activeStudents.filter((student) =>
        repeatSerials.has(student.user_serial?.trim() ?? ""),
      ).length;
      const previousYearLoyalStudents = activeStudents.filter((student) =>
        previousYearSerials.has(student.user_serial?.trim() ?? ""),
      ).length;
      const studentRombelIds = new Set(
        activeStudents
          .map((student) => student.rombel_id)
          .filter((rombelId): rombelId is number => typeof rombelId === "number"),
      );
      const activeStatusStudentRombelIds = new Set(
        activeStatusStudents
          .map((student) => student.rombel_id)
          .filter((rombelId): rombelId is number => typeof rombelId === "number"),
      );
      const branchRombels = rombelsByBranch.get(branch.branch_id) ?? [];
      const activeRombels = branchRombels.filter((rombel) => studentRombelIds.has(rombel.rombel_id)).length;
      const activeStatusRombels = branchRombels.filter((rombel) =>
        activeStatusStudentRombelIds.has(rombel.rombel_id),
      ).length;
      const incompleteStudents = activeStudents.filter(
        (student) =>
          !isFilled(student.user_serial) ||
          !student.birth_date ||
          !isFilled(student.email) ||
          !isFilled(student.npsn) ||
          student.rombel_id === null ||
          !isFilled(student.parents_name) ||
          !isFilled(student.parents_phone) ||
          student.agent_id === null ||
          student.payment_id === null,
      ).length;

      return {
        active_rombels: activeRombels,
        all_year_loyal_students: allYearLoyalStudents,
        avg_students_per_rombel:
          activeStatusRombels > 0 ? (activeStatusStudents.length / activeStatusRombels).toFixed(2) : "0.00",
        avg_students_per_rombel_value:
          activeStatusRombels > 0 ? activeStatusStudents.length / activeStatusRombels : 0,
        branch_id: branch.branch_id,
        branch_name: branch.branch_name,
        incomplete_students: incompleteStudents,
        loyal_students: `${previousYearLoyalStudents} / ${allYearLoyalStudents}`,
        previous_year_loyal_students: previousYearLoyalStudents,
        renewal_rate: `${formatRate(previousYearLoyalStudents, activeStudents.length)} / ${formatRate(
          allYearLoyalStudents,
          activeStudents.length,
        )}`,
        renewal_rate_value: activeStudents.length > 0 ? allYearLoyalStudents / activeStudents.length : 0,
        students_without_rombel: activeStudents.filter((student) => student.rombel_id === null).length,
        total_students: activeStudents.length,
        user_count: userCountByBranch.get(branch.branch_id) ?? 0,
      };
    });
  const sortedBranchMetrics = [...branchMetrics].sort((first, second) => {
    let comparison = 0;

    if (sortKey === "branch") {
      comparison = first.branch_name.localeCompare(second.branch_name);
    } else if (sortKey === "students") {
      comparison = compareNumber(first.total_students, second.total_students);
    } else if (sortKey === "students_loyal") {
      comparison =
        compareNumber(first.previous_year_loyal_students, second.previous_year_loyal_students) ||
        compareNumber(first.all_year_loyal_students, second.all_year_loyal_students);
    } else if (sortKey === "renewal_rate") {
      comparison = compareNumber(first.renewal_rate_value, second.renewal_rate_value);
    } else if (sortKey === "incomplete_students") {
      comparison = compareNumber(first.incomplete_students, second.incomplete_students);
    } else if (sortKey === "active_rombels") {
      comparison = compareNumber(first.active_rombels, second.active_rombels);
    } else if (sortKey === "avg_students_per_rombel") {
      comparison = compareNumber(first.avg_students_per_rombel_value, second.avg_students_per_rombel_value);
    }

    if (comparison === 0) {
      comparison = first.branch_name.localeCompare(second.branch_name);
    }

    return sortDirection === "asc" ? comparison : -comparison;
  });
  const topIncompleteBranches = [...branchMetrics]
    .filter((branch) => branch.incomplete_students > 0)
    .sort((first, second) => second.incomplete_students - first.incomplete_students)
    .slice(0, 5);

  return (
    <>
      <PageHeader
        description="Pantau branch, kelengkapan data siswa, dan aktivitas operasional terbaru."
        title="Operasional"
      />
      <section className="overflow-hidden rounded-md border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-bold">Siswa per Branch</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">Ringkasan kelengkapan data tiap branch.</p>
          </div>
          <AcademicYearFilter academicYears={academicYearList} selectedAcademicYear={selectedAcademicYear} />
        </div>
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full min-w-[760px] text-left text-sm font-normal text-slate-700">
            <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <SortableHeader
                  currentDirection={sortDirection}
                  currentSort={sortKey}
                  label="Branch"
                  selectedAcademicYear={selectedAcademicYear}
                  sortKey="branch"
                />
                <SortableHeader
                  align="right"
                  currentDirection={sortDirection}
                  currentSort={sortKey}
                  label="Siswa"
                  selectedAcademicYear={selectedAcademicYear}
                  sortKey="students"
                />
                <SortableHeader
                  align="right"
                  className="hidden sm:table-cell"
                  currentDirection={sortDirection}
                  currentSort={sortKey}
                  label="Siswa Loyal"
                  selectedAcademicYear={selectedAcademicYear}
                  sortKey="students_loyal"
                />
                <SortableHeader
                  align="right"
                  currentDirection={sortDirection}
                  currentSort={sortKey}
                  label="Renewal Rate"
                  selectedAcademicYear={selectedAcademicYear}
                  sortKey="renewal_rate"
                />
                <SortableHeader
                  align="right"
                  currentDirection={sortDirection}
                  currentSort={sortKey}
                  label="Belum lengkap"
                  selectedAcademicYear={selectedAcademicYear}
                  sortKey="incomplete_students"
                />
                <SortableHeader
                  align="right"
                  className="hidden sm:table-cell"
                  currentDirection={sortDirection}
                  currentSort={sortKey}
                  label="Rombel Aktif"
                  selectedAcademicYear={selectedAcademicYear}
                  sortKey="active_rombels"
                />
                <SortableHeader
                  align="right"
                  currentDirection={sortDirection}
                  currentSort={sortKey}
                  label="Avg Students/Rombel"
                  selectedAcademicYear={selectedAcademicYear}
                  sortKey="avg_students_per_rombel"
                />
              </tr>
            </thead>
            <tbody>
              {sortedBranchMetrics.map((branch) => (
                <tr className="border-t border-slate-200" key={branch.branch_id}>
                  <td className="px-4 py-3">{branch.branch_name}</td>
                  <td className="px-4 py-3 text-right">{formatNumber(branch.total_students)}</td>
                  <td className="hidden px-4 py-3 text-right sm:table-cell">{branch.loyal_students}</td>
                  <td className="px-4 py-3 text-right">{branch.renewal_rate}</td>
                  <td className="px-4 py-3 text-right">
                    {formatNumber(branch.incomplete_students)}
                  </td>
                  <td className="hidden px-4 py-3 text-right sm:table-cell">
                    {formatNumber(branch.active_rombels)}
                  </td>
                  <td className="px-4 py-3 text-right">{branch.avg_students_per_rombel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <BranchList
          emptyText="Semua branch sudah lengkap."
          items={topIncompleteBranches}
          label="Branch perlu perhatian"
          valueKey="incomplete_students"
        />
        <section className="overflow-hidden rounded-md border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            <h3 className="text-sm font-bold text-slate-700">Aktivitas Siswa Terbaru</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm font-normal text-slate-700">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-bold">Waktu</th>
                  <th className="px-4 py-3 font-bold">NIS</th>
                  <th className="px-4 py-3 font-bold">Nama</th>
                  <th className="px-4 py-3 font-bold">Branch</th>
                  <th className="px-4 py-3 font-bold">Status</th>
                  <th className="px-4 py-3 font-bold">Operator</th>
                </tr>
              </thead>
              <tbody>
                {scopedRecentStudentActivities.map((activity) => (
                  <tr className="border-t border-slate-200" key={`${activity.nis}-${activity.updated_at}`}>
                    <td className="whitespace-nowrap px-4 py-3">
                      {formatDateTime(activity.updated_at)}
                    </td>
                    <td className="px-4 py-3">{activity.nis}</td>
                    <td className="px-4 py-3">{activity.user_name ?? "-"}</td>
                    <td className="px-4 py-3">{activity.branch_name ?? "-"}</td>
                    <td className="px-4 py-3">{activity.status ?? "-"}</td>
                    <td className="px-4 py-3">{activity.operator_email ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
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
    <section className="overflow-hidden rounded-md border border-slate-200 bg-white">
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
    </section>
  );
}

function SortableHeader({
  align = "left",
  className = "",
  currentDirection,
  currentSort,
  label,
  selectedAcademicYear,
  sortKey,
}: {
  align?: "left" | "right";
  className?: string;
  currentDirection: SortDirection;
  currentSort: BranchSortKey;
  label: string;
  selectedAcademicYear: string;
  sortKey: BranchSortKey;
}) {
  const isActive = currentSort === sortKey;
  const nextDirection: SortDirection = isActive && currentDirection === "asc" ? "desc" : "asc";
  const params = new URLSearchParams();
  const Icon: LucideIcon = isActive ? (currentDirection === "asc" ? ArrowUp : ArrowDown) : ChevronsUpDown;

  if (selectedAcademicYear) {
    params.set("academic_year", selectedAcademicYear);
  }
  params.set("sort", sortKey);
  params.set("direction", nextDirection);

  return (
    <th className={`px-4 py-3 font-bold ${align === "right" ? "text-right" : ""} ${className}`}>
      <Link
        className={`inline-flex items-center gap-1.5 rounded-md text-slate-500 hover:text-[#2f6696] ${
          align === "right" ? "justify-end" : ""
        }`}
        href={`/administrator/operations?${params.toString()}`}
        scroll={false}
      >
        <span>{label}</span>
        <Icon className="size-3.5" aria-hidden="true" />
      </Link>
    </th>
  );
}
