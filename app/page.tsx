import Link from "next/link";
import { X } from "lucide-react";
import { createBranchSchool, deleteRombel, deleteStudent, mutateStudent } from "@/app/auth/actions";
import { AutoSubmitSelect } from "@/app/components/auto-submit-select";
import { buttonGroups, buttonStyles } from "@/app/components/button-styles";
import { ModalCloseLink } from "@/app/components/modal-close-link";
import { RombelTableCard } from "@/app/components/rombel-table-card";
import { RombelFormModal } from "@/app/components/rombel-form-modal";
import { SchoolTableCard } from "@/app/components/school-table-card";
import { StudentCreateToast } from "@/app/components/student-create-toast";
import { StudentFormModal } from "@/app/components/student-form-modal";
import { StudentTableCard } from "@/app/components/student-table-card";
import { SubmitButton } from "@/app/components/submit-button";
import { UserDropupMenu } from "@/app/components/user-dropup-menu";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server";

type SearchParams = {
  branch?: string;
  year?: string;
  q?: string;
  incomplete?: string;
  loyal?: string;
  status?: string;
  page?: string;
  schoolPage?: string;
  rombelPage?: string;
  studentRefresh?: string;
  rombelRefresh?: string;
  student?: string;
  deleteStudent?: string;
  mutateStudent?: string;
  mutationSuccess?: string;
  history?: string;
  rombel?: string;
  editRombel?: string;
  deleteRombel?: string;
  rombelStudents?: string;
  school?: string;
  addSchool?: string;
  addStudent?: string;
  editStudent?: string;
  studentError?: string;
  lookupNpsn?: string;
  addRombel?: string;
  rombelError?: string;
};

type AppProfile = {
  name: string | null;
  email: string | null;
  position: string | null;
  role_id: string;
  id?: string;
};

type DetailValue = string | number | boolean | null;
type DetailRecord = Record<string, DetailValue>;
type DetailRow = [label: string, value: DetailValue];

type AuditLogRow = {
  id: number;
  entity_type: string;
  entity_id: string | null;
  action: string;
  branch_id: number | null;
  destination_branch_id: number | null;
  actor_email: string | null;
  detail: {
    changed_fields?: Record<string, { before: DetailValue; after: DetailValue }>;
  } | null;
  created_at: string | null;
};

type Branch = {
  branch_id: number;
  branch_name: string;
};

type DashboardSummary = {
  active_students: number;
  incomplete_students: number;
  loyal_students: string;
  active_rombels: number;
  renewal_rate: string;
  avg_students_per_rombel: string;
};

function formatAuditDateTime(value: string | null) {
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

function formatAuditValue(value: DetailValue) {
  if (value === null || value === "") {
    return "kosong";
  }

  return String(value);
}

function auditChangeSummary(
  changedFields?: Record<string, { before: DetailValue; after: DetailValue }>,
) {
  const entries = Object.entries(changedFields ?? {}).slice(0, 3);

  if (entries.length === 0) {
    return "Tidak ada detail perubahan field.";
  }

  return entries
    .map(([field, values]) => `${field}: ${formatAuditValue(values.before)} -> ${formatAuditValue(values.after)}`)
    .join(", ");
}

function auditActionLabel(action: string) {
  const labels: Record<string, string> = {
    create: "Tambah",
    update: "Edit",
    delete: "Hapus",
    mutate: "Mutasi",
  };

  return labels[action] ?? action;
}

const schoolPageSize = 20;
const rombelPageSize = 20;
const pageSize = 20;

const detailFields =
  "nis, payment_date, academic_year, user_serial, user_name, user_phone, birth_date, email, grade_id, grade, npsn, school_name, rombel_id, rombel_name, parents_name, parents_phone, agent_id, agent_name, payment_id, payment_method, status, branch_id, branch_name";

type StudentFormSchool = {
  npsn: string;
  name: string | null;
  level: string | null;
  student_count: number | null;
};

function isStudentFormSchool(school: StudentFormSchool | null): school is StudentFormSchool {
  return Boolean(school);
}

async function getAccessibleBranches(userId: string | undefined, isAdmin: boolean) {
  if (!userId) {
    return [];
  }

  const supabase = createSupabaseServiceRoleClient();

  if (isAdmin) {
    const { data } = await supabase
      .from("t_branch")
      .select("branch_id, branch_name")
      .neq("branch_id", 100)
      .order("branch_name");

    return data ?? [];
  }

  const { data: userBranches } = await supabase
    .from("t_app_user_branch")
    .select("branch_id")
    .eq("user_id", userId)
    .neq("branch_id", 100)
    .order("branch_id");

  const branchIds = userBranches?.map((row) => row.branch_id).filter(Boolean) ?? [];

  if (branchIds.length === 0) {
    return [];
  }

  const { data } = await supabase
    .from("t_branch")
    .select("branch_id, branch_name")
    .in("branch_id", branchIds)
    .neq("branch_id", 100)
    .order("branch_name");

  return data ?? [];
}

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

async function getDashboardSummary(branchId: number, academicYear: string): Promise<DashboardSummary> {
  const supabase = createSupabaseServiceRoleClient();
  const [{ data: students }, { data: rombels }] = await Promise.all([
    supabase
      .from("t_students")
      .select(
        "nis, user_serial, birth_date, email, npsn, rombel_id, parents_name, parents_phone, agent_id, payment_id, status",
      )
      .eq("branch_id", branchId)
      .eq("academic_year", academicYear)
      .neq("status", "Deleted"),
    supabase
      .from("t_rombel")
      .select("rombel_id")
      .eq("branch_id", branchId)
      .eq("academic_year", academicYear),
  ]);

  const activeStudents = students ?? [];
  const activeStatusStudents = activeStudents.filter((student) => student.status === "Active");
  const selectedYearSerials = [
    ...new Set(
      activeStudents
        .map((student) => student.user_serial?.trim())
        .filter((serial): serial is string => Boolean(serial)),
    ),
  ];
  const previousYear = previousAcademicYear(academicYear);
  const [{ data: repeatPurchaseRows }, { data: previousYearRows }] = await Promise.all([
    selectedYearSerials.length > 0
      ? supabase
          .from("t_students")
          .select("user_serial")
          .in("user_serial", selectedYearSerials)
          .neq("academic_year", academicYear)
          .neq("status", "Deleted")
      : Promise.resolve({ data: [] }),
    selectedYearSerials.length > 0 && previousYear
      ? supabase
          .from("t_students")
          .select("user_serial")
          .in("user_serial", selectedYearSerials)
          .eq("academic_year", previousYear)
          .neq("status", "Deleted")
      : Promise.resolve({ data: [] }),
  ]);
  const allYearLoyalSerials = new Set(
    (repeatPurchaseRows ?? [])
      .map((student) => student.user_serial?.trim())
      .filter((serial): serial is string => Boolean(serial)),
  );
  const previousYearLoyalSerials = new Set(
    (previousYearRows ?? [])
      .map((student) => student.user_serial?.trim())
      .filter((serial): serial is string => Boolean(serial)),
  );
  const allYearLoyalStudents = activeStudents.filter((student) =>
    allYearLoyalSerials.has(student.user_serial?.trim() ?? ""),
  ).length;
  const previousYearLoyalStudents = activeStudents.filter((student) =>
    previousYearLoyalSerials.has(student.user_serial?.trim() ?? ""),
  ).length;
  const filled = (value: string | null) => Boolean(value?.trim());
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
  const studentCountByRombel = new Map<number, number>();
  activeStudents.forEach((student) => {
    if (typeof student.rombel_id === "number") {
      studentCountByRombel.set(
        student.rombel_id,
        (studentCountByRombel.get(student.rombel_id) ?? 0) + 1,
      );
    }
  });

  const incompleteStudents = activeStudents.filter(
    (student) =>
      !filled(student.user_serial) ||
      !student.birth_date ||
      !filled(student.email) ||
      !filled(student.npsn) ||
      student.rombel_id === null ||
      !filled(student.parents_name) ||
      !filled(student.parents_phone) ||
      student.agent_id === null ||
      student.payment_id === null,
  ).length;
  const activeRombels = (rombels ?? []).filter((rombel) => studentRombelIds.has(rombel.rombel_id)).length;
  const activeStatusRombels = (rombels ?? []).filter((rombel) =>
    activeStatusStudentRombelIds.has(rombel.rombel_id),
  ).length;

  return {
    active_students: activeStudents.length,
    incomplete_students: incompleteStudents,
    loyal_students: `${previousYearLoyalStudents} / ${allYearLoyalStudents}`,
    active_rombels: activeRombels,
    renewal_rate: `${formatRate(previousYearLoyalStudents, activeStudents.length)} / ${formatRate(
      allYearLoyalStudents,
      activeStudents.length,
    )}`,
    avg_students_per_rombel:
      activeStatusRombels > 0 ? (activeStatusStudents.length / activeStatusRombels).toFixed(2) : "0.00",
  };
}

async function getDashboardData(params: SearchParams) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const dataSupabase = createSupabaseServiceRoleClient();

  const [{ data: profile }, { data: years }, { data: activeYears }, { data: grades }] = await Promise.all([
    user
      ? dataSupabase
          .from("t_app_user")
          .select("id, name, email, position, role_id")
          .eq("id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    dataSupabase
      .from("t_academic_year")
      .select("academic_year, is_active")
      .order("academic_year", { ascending: false }),
    dataSupabase
      .from("t_academic_year")
      .select("academic_year")
      .eq("is_active", true)
      .order("academic_year", { ascending: false }),
    dataSupabase.from("t_grade").select("grade_id, grade, level").order("grade_id"),
  ]);

  const profileRole = typeof profile?.role_id === "string" ? profile.role_id : "";
  const branches = (await getAccessibleBranches(user?.id, profileRole === "admin")) as Branch[];

  const selectedBranch =
    branches.find((branch) => String(branch.branch_id) === params.branch) ?? branches[0] ?? null;
  const { data: branchStudentYears } = selectedBranch
    ? await dataSupabase
        .from("t_students")
        .select("academic_year")
        .eq("branch_id", selectedBranch.branch_id)
        .neq("status", "Deleted")
        .order("academic_year", { ascending: false })
    : { data: [] };
  const availableYears = [...new Set((branchStudentYears ?? []).map((row) => row.academic_year).filter(Boolean))];
  const selectedYear =
    (params.year && availableYears.includes(params.year) ? params.year : null) ??
    availableYears[0] ??
    years?.find((year) => year.is_active)?.academic_year ??
    years?.[0]?.academic_year ??
    "26/27";
  const query = params.q?.trim() ?? "";
  const incompleteOnly = params.incomplete === "1";
  const loyalOnly = params.loyal === "1";
  const studentStatusFilter =
    params.status === "Active" || params.status === "Inactive" ? params.status : "";
  const currentPage = Math.max(Number(params.page ?? "1") || 1, 1);
  const currentSchoolPage = Math.max(Number(params.schoolPage ?? "1") || 1, 1);
  const currentRombelPage = Math.max(Number(params.rombelPage ?? "1") || 1, 1);
  const from = (currentPage - 1) * pageSize;
  const to = from + pageSize - 1;
  const schoolFrom = (currentSchoolPage - 1) * schoolPageSize;
  const schoolTo = schoolFrom + schoolPageSize - 1;
  const rombelFrom = (currentRombelPage - 1) * rombelPageSize;
  const rombelTo = rombelFrom + rombelPageSize - 1;

  if (!selectedBranch) {
    return {
      branches,
      years: years ?? [],
      selectedBranch,
      selectedYear,
      availableYears,
      query,
      incompleteOnly,
      loyalOnly,
      studentStatusFilter,
      currentPage,
      totalStudents: 0,
      totalPages: 1,
      currentSchoolPage,
      totalSchools: 0,
      totalSchoolPages: 1,
      currentRombelPage,
      totalRombels: 0,
      totalRombelPages: 1,
      summary: null,
      students: [],
      serialCounts: {},
      schools: [],
      rombels: [],
      studentFormRombels: [],
      selectedStudent: null,
      purchaseHistory: [],
      selectedRombel: null,
      rombelStudents: [],
      selectedSchool: null,
      selectedSchoolYearCounts: [],
      schoolLookup: null,
      schoolAlreadyRegistered: false,
      lookupNpsn: "",
      paymentMethods: [],
      agents: [],
      activeYears: activeYears ?? [],
      studentFormSchools: [],
      grades: grades ?? [],
      profile: profile as AppProfile | null,
      userEmail: user?.email ?? null,
    };
  }

  let studentQuery = dataSupabase
    .from("v_student_detail")
    .select("nis, user_name, school_name, grade, rombel_name, user_serial, is_incomplete, status", {
      count: "exact",
    })
    .eq("branch_id", selectedBranch.branch_id)
    .eq("academic_year", selectedYear);

  if (query) {
    const escapedQuery = query.replaceAll("%", "\\%").replaceAll("_", "\\_");
    studentQuery = studentQuery.or(
      [
        `nis.ilike.%${escapedQuery}%`,
        `user_name.ilike.%${escapedQuery}%`,
        `email.ilike.%${escapedQuery}%`,
        `school_name.ilike.%${escapedQuery}%`,
        `user_serial.ilike.%${escapedQuery}%`,
      ].join(","),
    );
  }

  if (incompleteOnly) {
    studentQuery = studentQuery.eq("is_incomplete", true);
  }
  if (studentStatusFilter) {
    studentQuery = studentQuery.eq("status", studentStatusFilter);
  }
  if (loyalOnly) {
    const { data: currentYearSerialRows } = await dataSupabase
      .from("t_students")
      .select("user_serial")
      .eq("branch_id", selectedBranch.branch_id)
      .eq("academic_year", selectedYear)
      .neq("status", "Deleted");
    const currentYearSerials = [
      ...new Set(
        (currentYearSerialRows ?? [])
          .map((student) => student.user_serial?.trim())
          .filter((serial): serial is string => Boolean(serial)),
      ),
    ];

    if (currentYearSerials.length > 0) {
      const { data: loyalSerialRows } = await dataSupabase
        .from("t_students")
        .select("user_serial")
        .in("user_serial", currentYearSerials)
        .neq("academic_year", selectedYear)
        .neq("status", "Deleted");
      const loyalSerials = [
        ...new Set(
          (loyalSerialRows ?? [])
            .map((student) => student.user_serial?.trim())
            .filter((serial): serial is string => Boolean(serial)),
        ),
      ];

      studentQuery = loyalSerials.length > 0 ? studentQuery.in("user_serial", loyalSerials) : studentQuery.eq("user_serial", "__none__");
    } else {
      studentQuery = studentQuery.eq("user_serial", "__none__");
    }
  }

  const [
    { data: students, count: studentCount },
    { data: schools, count: schoolCount },
    { data: rombels, count: rombelCount },
  ] = await Promise.all([
    studentQuery.order("nis", { ascending: false }).range(from, to),
    dataSupabase
      .from("v_branch_school_detail")
      .select("npsn, school_name, level, school_status, student_count", { count: "exact" })
      .eq("branch_id", selectedBranch.branch_id)
      .order("student_count", { ascending: false })
      .order("school_name", { ascending: true })
      .range(schoolFrom, schoolTo),
    dataSupabase
      .from("v_rombel_detail")
      .select("rombel_id, grade, rombel_name, student_count", { count: "exact" })
      .eq("branch_id", selectedBranch.branch_id)
      .eq("academic_year", selectedYear)
      .order("grade", { ascending: true })
      .order("rombel_name", { ascending: true })
      .range(rombelFrom, rombelTo),
  ]);

  const { data: selectedStudent } = params.student
    ? await dataSupabase
        .from("v_student_detail")
        .select(detailFields)
        .eq("nis", params.student)
        .maybeSingle()
    : { data: null };

  const { data: purchaseHistory } = selectedStudent?.user_serial
    ? await dataSupabase
        .from("v_student_detail")
        .select(
          "nis, academic_year, grade, school_name, branch_name, agent_name, user_name, birth_date, email, user_serial",
        )
        .eq("user_serial", selectedStudent.user_serial)
        .order("academic_year", { ascending: false })
    : { data: [] };

  const { data: studentAuditLogs } = selectedStudent?.nis
    ? await dataSupabase
        .from("t_admin_audit_log")
        .select("id, entity_type, entity_id, action, branch_id, destination_branch_id, actor_email, detail, created_at")
        .eq("entity_type", "student")
        .eq("entity_id", selectedStudent.nis)
        .order("created_at", { ascending: false })
        .limit(5)
    : { data: [] };

  const selectedRombelId = params.rombel ?? params.editRombel ?? params.deleteRombel;
  const { data: selectedRombel } = selectedRombelId
    ? await dataSupabase
        .from("v_rombel_detail")
        .select("rombel_id, rombel_name, grade_id, grade, academic_year, branch_name, student_count")
        .eq("rombel_id", selectedRombelId)
        .maybeSingle()
    : { data: null };

  const { data: rombelStudents } =
    selectedRombel && params.rombelStudents === "1"
      ? await dataSupabase
          .from("v_student_detail")
          .select("nis, user_name, school_name")
          .eq("rombel_id", selectedRombel.rombel_id)
          .order("user_name")
      : { data: [] };

  const { data: selectedSchool } = params.school
    ? await dataSupabase
        .from("v_branch_school_detail")
        .select("npsn, school_name, level, school_status, address, district, city, province")
        .eq("npsn", params.school)
        .eq("branch_id", selectedBranch.branch_id)
        .maybeSingle()
    : { data: null };

  const { count: selectedSchoolStudentCount } = selectedSchool
    ? await dataSupabase
        .from("v_student_detail")
        .select("nis", { count: "exact", head: true })
        .eq("npsn", selectedSchool.npsn)
        .eq("branch_id", selectedBranch.branch_id)
    : { count: 0 };
  const { data: selectedSchoolYearRows } = selectedSchool
    ? await dataSupabase
        .from("v_student_detail")
        .select("academic_year")
        .eq("npsn", selectedSchool.npsn)
        .eq("branch_id", selectedBranch.branch_id)
        .neq("status", "Deleted")
        .order("academic_year", { ascending: false })
    : { data: [] };
  const selectedSchoolYearCounts = Array.from(
    (selectedSchoolYearRows ?? []).reduce((acc, row) => {
      const academicYear = row.academic_year?.trim();
      if (!academicYear) {
        return acc;
      }

      acc.set(academicYear, (acc.get(academicYear) ?? 0) + 1);
      return acc;
    }, new Map<string, number>()).entries(),
  ).map(([academic_year, student_count]) => ({ academic_year, student_count }));

  const normalizedLookupNpsn = params.lookupNpsn?.trim() ?? "";
  const { data: lookupSchool } =
    params.addSchool === "1" && normalizedLookupNpsn
      ? await dataSupabase
          .from("t_master_school")
          .select("npsn, name, level, status, address, district, city, province")
          .eq("npsn", normalizedLookupNpsn)
          .maybeSingle()
      : { data: null };

  const needsStudentFormData = params.addStudent === "1" || params.editStudent === "1";

  const { data: studentFormSchools } =
    needsStudentFormData
      ? await dataSupabase
          .from("v_branch_school_detail")
          .select("npsn, school_name, level, student_count")
          .eq("branch_id", selectedBranch.branch_id)
          .order("student_count", { ascending: false })
          .order("school_name", { ascending: true })
      : { data: [] };

  const [{ data: paymentMethods }, { data: agents }, { data: studentFormRombels }] =
    needsStudentFormData
      ? await Promise.all([
          dataSupabase
            .from("t_payment_method")
            .select("payment_id, payment_method")
            .eq("is_active", true)
            .order("payment_id"),
          dataSupabase
            .from("t_agent")
            .select("agent_id, agent_name, branch_id")
            .eq("is_active", true)
            .order("agent_name"),
          dataSupabase
            .from("v_rombel_detail")
            .select("rombel_id, rombel_name, grade, academic_year")
            .eq("branch_id", selectedBranch.branch_id)
            .order("grade", { ascending: true })
            .order("rombel_name", { ascending: true }),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }];

  const { data: registeredSchool } =
    params.addSchool === "1" && normalizedLookupNpsn
      ? await dataSupabase
          .from("t_branch_school")
          .select("npsn")
          .eq("npsn", normalizedLookupNpsn)
          .eq("branch_id", selectedBranch.branch_id)
          .maybeSingle()
      : { data: null };

  const totalStudents = studentCount ?? 0;
  const totalSchools = schoolCount ?? 0;
  const serialCounts = Object.fromEntries(
    (students ?? []).map((student) => [student.user_serial, 0]),
  );
  const serials = Object.keys(serialCounts).filter(Boolean);

  if (serials.length > 0) {
    const { data: serialRows } = await dataSupabase
      .from("v_student_detail")
      .select("user_serial")
      .in("user_serial", serials);

    serialRows?.forEach((row) => {
      serialCounts[row.user_serial] = (serialCounts[row.user_serial] ?? 0) + 1;
    });
  }

  const summary = await getDashboardSummary(selectedBranch.branch_id, selectedYear);

  return {
    branches,
    years: years ?? [],
    selectedBranch,
    selectedYear,
    availableYears,
    query,
    incompleteOnly,
    loyalOnly,
    studentStatusFilter,
    currentPage,
    totalStudents,
    totalPages: Math.max(Math.ceil(totalStudents / pageSize), 1),
    currentSchoolPage,
    totalSchools,
    totalSchoolPages: Math.max(Math.ceil(totalSchools / schoolPageSize), 1),
    currentRombelPage,
    totalRombels: rombelCount ?? 0,
    totalRombelPages: Math.max(Math.ceil((rombelCount ?? 0) / rombelPageSize), 1),
    summary,
    students: students ?? [],
    serialCounts,
    schools: schools ?? [],
    rombels: rombels ?? [],
    studentFormRombels: studentFormRombels ?? [],
    selectedStudent,
    studentAuditLogs: studentAuditLogs ?? [],
    purchaseHistory: purchaseHistory ?? [],
    selectedRombel,
    rombelStudents: rombelStudents ?? [],
    selectedSchool: selectedSchool
      ? { ...selectedSchool, student_count: selectedSchoolStudentCount ?? 0 }
      : null,
    selectedSchoolYearCounts,
    schoolLookup: lookupSchool,
    schoolAlreadyRegistered: Boolean(registeredSchool),
    lookupNpsn: normalizedLookupNpsn,
    activeYears: activeYears ?? [],
    studentFormSchools:
      studentFormSchools
        ?.map((school) => ({
          npsn: school.npsn,
          name: school.school_name,
          level: school.level,
          student_count: school.student_count,
        }))
        .filter(isStudentFormSchool) ?? [],
    paymentMethods: paymentMethods ?? [],
    agents:
      [...(agents ?? [])].sort((first, second) => {
        const firstBranchOrder =
          first.branch_id === selectedBranch.branch_id ? 0 : first.branch_id === 100 ? 1 : 2;
        const secondBranchOrder =
          second.branch_id === selectedBranch.branch_id ? 0 : second.branch_id === 100 ? 1 : 2;

        if (firstBranchOrder !== secondBranchOrder) {
          return firstBranchOrder - secondBranchOrder;
        }

        return String(first.agent_name ?? "").localeCompare(String(second.agent_name ?? ""));
      }) ?? [],
    grades: grades ?? [],
    profile: profile as AppProfile | null,
    userEmail: user?.email ?? null,
  };
}

const metricLabels = [
  ["Siswa Aktif", "active_students"],
  ["Siswa Loyal", "loyal_students"],
  ["Data Belum Lengkap", "incomplete_students"],
  ["Rombel Aktif", "active_rombels"],
  ["Renewal Rate", "renewal_rate"],
  ["Avg Students/Rombel", "avg_students_per_rombel"],
] as const;

function ModalCloseButton({ href }: { href: string }) {
  return (
    <ModalCloseLink
      aria-label="Tutup modal"
      className={buttonStyles.iconClose}
      href={href}
      title="Tutup"
    >
      <X className="size-4" aria-hidden="true" />
    </ModalCloseLink>
  );
}

function schoolPageHref(data: Awaited<ReturnType<typeof getDashboardData>>, page: number) {
  const params = new URLSearchParams();

  if (data.selectedBranch) {
    params.set("branch", String(data.selectedBranch.branch_id));
  }

  params.set("year", data.selectedYear);
  params.set("schoolPage", String(page));

  return `/?${params.toString()}`;
}

function pageBaseHref(data: Awaited<ReturnType<typeof getDashboardData>>) {
  const params = new URLSearchParams();

  if (data.selectedBranch) {
    params.set("branch", String(data.selectedBranch.branch_id));
  }

  params.set("year", data.selectedYear);

  if (data.query) {
    params.set("q", data.query);
  }

  if (data.incompleteOnly) {
    params.set("incomplete", "1");
  }
  if (data.loyalOnly) {
    params.set("loyal", "1");
  }
  if (data.studentStatusFilter) {
    params.set("status", data.studentStatusFilter);
  }

  params.set("page", String(data.currentPage));

  return `/?${params.toString()}`;
}

function schoolPageBaseHref(data: Awaited<ReturnType<typeof getDashboardData>>) {
  return schoolPageHref(data, data.currentSchoolPage);
}

function rombelPageHref(data: Awaited<ReturnType<typeof getDashboardData>>, page: number) {
  const params = new URLSearchParams();

  if (data.selectedBranch) {
    params.set("branch", String(data.selectedBranch.branch_id));
  }

  params.set("year", data.selectedYear);
  params.set("rombelPage", String(page));

  return `/?${params.toString()}`;
}

function rombelPageBaseHref(data: Awaited<ReturnType<typeof getDashboardData>>) {
  return rombelPageHref(data, data.currentRombelPage);
}

function dashboardHref(
  data: Awaited<ReturnType<typeof getDashboardData>>,
  overrides: Record<string, string | null>,
) {
  const params = new URLSearchParams(pageBaseHref(data).slice(2));

  Object.entries(overrides).forEach(([key, value]) => {
    if (value === null) {
      params.delete(key);
      return;
    }

    params.set(key, value);
  });

  return `/?${params.toString()}`;
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const data = await getDashboardData(params);
  const hasPurchaseHistory = data.purchaseHistory.length > 1;

  return (
    <main className="min-h-screen bg-[#f3f6fb] text-slate-900">
      <header className="sticky top-0 z-40 bg-[#2f6696] px-6 py-2 text-white shadow-sm sm:px-10">
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-100">Dashboard Jawa Timur v2.2</p>
            <h1 className="text-2xl font-bold tracking-normal">Data Bayar Jawa Timur</h1>
            <p className="mt-1 text-xs font-semibold text-blue-100">
              Kelola data siswa, sekolah, dan rombel dalam satu halaman.
            </p>
          </div>
          <form className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="text-left sm:text-right">
              <p className="text-xs font-semibold text-blue-100">
                {data.profile?.position ?? "Position"}
              </p>
              <p className="font-bold">{data.profile?.name ?? data.userEmail ?? "User"}</p>
              <p className="text-xs font-semibold text-blue-100">
                {data.userEmail ?? data.profile?.email ?? ""}
              </p>
            </div>
            <AutoSubmitSelect
              label="Branch Aktif"
              name="branch"
              value={String(data.selectedBranch?.branch_id ?? "")}
              variant="header"
              options={data.branches.map((branch) => ({
                label: branch.branch_name,
                value: String(branch.branch_id),
              }))}
            />
          </form>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-6 py-8 sm:px-10">
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <form className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_160px] lg:items-start">
            <div>
              <h2 className="text-2xl font-bold">
                Ringkasan {data.selectedBranch?.branch_name ?? "Branch"}
              </h2>
              <p className="mt-2 text-sm font-semibold text-slate-500">
                {data.selectedBranch?.branch_name ?? "Branch belum tersedia"} | Tahun Ajaran:{" "}
                {data.selectedYear}
              </p>
            </div>
            <div className="grid justify-self-start gap-3 lg:justify-self-end">
              {data.selectedBranch && (
                <input name="branch" type="hidden" value={data.selectedBranch.branch_id} />
              )}
              <AutoSubmitSelect
                label="Tahun Ajaran"
                name="year"
                value={data.selectedYear}
                options={
                  data.availableYears.length
                    ? data.availableYears.map((year) => ({
                        label: year,
                        value: year,
                      }))
                    : [{ label: data.selectedYear, value: data.selectedYear }]
                }
              />
            </div>
          </form>

          <div className="mt-5 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            {metricLabels.map(([label, key]) => {
              const shouldWarn =
                (key === "incomplete_students" && (data.summary?.incomplete_students ?? 0) > 0) ||
                (key === "avg_students_per_rombel" &&
                  Number(data.summary?.avg_students_per_rombel ?? 0) < 10);

              return (
                <div
                  key={key}
                  className={`rounded-lg border px-3 py-2.5 ${
                    shouldWarn ? "border-red-200 bg-red-50" : "border-slate-200 bg-slate-100"
                  }`}
                >
                  <p className="text-xs font-bold text-slate-500">{label}</p>
                  <p className="mt-1.5 text-xl font-bold text-slate-800">
                    {data.summary?.[key] ?? 0}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <StudentTableCard
          key={`${data.selectedBranch?.branch_id ?? "none"}-${data.selectedYear}-${data.query}-${data.incompleteOnly}-${data.loyalOnly}-${data.studentStatusFilter}-${data.currentPage}-${params.studentRefresh ?? ""}`}
          branchId={data.selectedBranch?.branch_id ?? null}
          branchName={data.selectedBranch?.branch_name ?? "-"}
          academicYear={data.selectedYear}
          query={data.query}
          incompleteOnly={data.incompleteOnly}
          loyalOnly={data.loyalOnly}
          statusFilter={data.studentStatusFilter}
          keepParams={{
            addSchool: params.addSchool,
            lookupNpsn: params.lookupNpsn,
            school: params.school,
            student: params.student,
            history: params.history,
            rombel: params.rombel,
            rombelStudents: params.rombelStudents,
          }}
          initialStudents={data.students}
          initialSerialCounts={data.serialCounts}
          initialCurrentPage={data.currentPage}
          initialTotalPages={data.totalPages}
          initialTotalStudents={data.totalStudents}
          detailBaseHref={dashboardHref(data, {
            student: null,
            history: null,
          })}
          addStudentHref={dashboardHref(data, {
            addStudent: "1",
            student: null,
            history: null,
            school: null,
            rombel: null,
            rombelStudents: null,
          })}
          pageBaseHref={pageBaseHref(data)}
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <SchoolTableCard
            key={`${data.selectedBranch?.branch_id ?? "none"}-${data.currentSchoolPage}`}
            branchId={data.selectedBranch?.branch_id ?? null}
            initialSchools={data.schools}
            initialCurrentPage={data.currentSchoolPage}
            initialTotalPages={data.totalSchoolPages}
            initialTotalSchools={data.totalSchools}
            actionHref={dashboardHref(data, {
              addSchool: "1",
              lookupNpsn: null,
              school: null,
              student: null,
              history: null,
              rombel: null,
              rombelStudents: null,
            })}
            detailBaseHref={dashboardHref(data, {
              school: null,
              student: null,
              history: null,
              rombel: null,
              rombelStudents: null,
            })}
            pageBaseHref={schoolPageBaseHref(data)}
          />
          <RombelTableCard
            key={`${data.selectedBranch?.branch_id ?? "none"}-${data.selectedYear}-${data.currentRombelPage}-${params.rombelRefresh ?? ""}`}
            branchId={data.selectedBranch?.branch_id ?? null}
            academicYear={data.selectedYear}
            initialRombels={data.rombels}
            initialCurrentPage={data.currentRombelPage}
            initialTotalPages={data.totalRombelPages}
            initialTotalRombels={data.totalRombels}
            actionHref={dashboardHref(data, {
              addRombel: "1",
              rombel: null,
              rombelStudents: null,
              student: null,
              history: null,
              school: null,
            })}
            detailBaseHref={dashboardHref(data, {
              rombel: null,
              rombelStudents: null,
              student: null,
              history: null,
            })}
            pageBaseHref={rombelPageBaseHref(data)}
          />
        </div>

        <footer className="py-4 text-center text-sm italic text-slate-500">
          <p>Data Bayar Teritori Jawa Timur</p>
          <p className="mt-1">Created by RE@2026</p>
        </footer>
      </div>

      <div className="fixed bottom-4 right-4 z-40">
        <UserDropupMenu
          isAdmin={data.profile?.role_id === "admin"}
          label={data.userEmail ?? data.profile?.email ?? "User"}
        />
      </div>
      <StudentCreateToast currentUserId={data.profile?.id ?? null} />

      {data.selectedStudent && (
        <StudentDetailModal
          student={data.selectedStudent}
          auditLogs={data.studentAuditLogs}
          closeHref={dashboardHref(data, { student: null, history: null })}
          historyHref={dashboardHref(data, { student: data.selectedStudent.nis, history: "1" })}
          hasPurchaseHistory={hasPurchaseHistory}
          isBackground={params.history === "1"}
          editHref={dashboardHref(data, {
            student: data.selectedStudent.nis,
            editStudent: "1",
            history: null,
          })}
          deleteHref={dashboardHref(data, {
            student: data.selectedStudent.nis,
            deleteStudent: "1",
            history: null,
            editStudent: null,
          })}
          mutateHref={dashboardHref(data, {
            student: data.selectedStudent.nis,
            mutateStudent: "1",
            history: null,
            editStudent: null,
            deleteStudent: null,
          })}
        />
      )}

      {data.selectedStudent && params.deleteStudent === "1" && (
        <DeleteStudentConfirmModal
          student={data.selectedStudent}
          closeHref={dashboardHref(data, {
            student: data.selectedStudent.nis,
            deleteStudent: null,
          })}
          redirectTo={dashboardHref(data, {
            student: null,
            deleteStudent: null,
            history: null,
            editStudent: null,
          })}
        />
      )}

      {data.selectedStudent && params.mutateStudent === "1" && (
        <MutateStudentModal
          branches={data.branches}
          student={data.selectedStudent}
          closeHref={dashboardHref(data, {
            student: data.selectedStudent.nis,
            mutateStudent: null,
          })}
          redirectTo={dashboardHref(data, {
            student: null,
            mutateStudent: null,
            history: null,
            editStudent: null,
            deleteStudent: null,
            mutationSuccess: "1",
          })}
        />
      )}

      {params.mutationSuccess === "1" && (
        <MutationSuccessModal closeHref={dashboardHref(data, { mutationSuccess: null })} />
      )}

      {data.selectedStudent && params.history === "1" && (
        <PurchaseHistoryModal
          student={data.selectedStudent}
          rows={data.purchaseHistory}
          closeHref={dashboardHref(data, { student: data.selectedStudent.nis, history: null })}
        />
      )}

      {data.selectedRombel && params.rombel && (
        <RombelDetailModal
          rombel={data.selectedRombel}
          closeHref={dashboardHref(data, { rombel: null, rombelStudents: null })}
          studentsHref={dashboardHref(data, {
            rombel: data.selectedRombel.rombel_id,
            rombelStudents: "1",
          })}
          isBackground={params.rombelStudents === "1"}
        />
      )}

      {data.selectedRombel && params.deleteRombel && (
        <DeleteRombelConfirmModal
          rombel={data.selectedRombel}
          closeHref={dashboardHref(data, { deleteRombel: null })}
          redirectTo={dashboardHref(data, {
            deleteRombel: null,
            rombel: null,
            rombelStudents: null,
          })}
        />
      )}

      {data.selectedRombel && params.rombelStudents === "1" && (
        <RombelStudentsModal
          rombel={data.selectedRombel}
          rows={data.rombelStudents}
          closeHref={dashboardHref(data, {
            rombel: data.selectedRombel.rombel_id,
            rombelStudents: null,
          })}
        />
      )}

      {data.selectedSchool && (
        <SchoolDetailModal
          school={data.selectedSchool}
          yearCounts={data.selectedSchoolYearCounts}
          closeHref={dashboardHref(data, { school: null })}
        />
      )}

      {params.addSchool === "1" && (
        <SchoolLookupModal
          branchId={data.selectedBranch?.branch_id ?? null}
          branchName={data.selectedBranch?.branch_name ?? "-"}
          academicYear={data.selectedYear}
          redirectTo={dashboardHref(data, { addSchool: null, lookupNpsn: null })}
          closeHref={dashboardHref(data, { addSchool: null, lookupNpsn: null })}
          lookupNpsn={data.lookupNpsn}
          school={data.schoolLookup}
          alreadyRegistered={data.schoolAlreadyRegistered}
        />
      )}

      {params.addStudent === "1" && data.selectedBranch && (
        <StudentFormModal
          branchId={data.selectedBranch.branch_id}
          branchName={data.selectedBranch.branch_name}
          closeHref={dashboardHref(data, { addStudent: null, studentError: null })}
          redirectTo={dashboardHref(data, { addStudent: null, studentError: null })}
          years={data.activeYears}
          grades={data.grades}
          schools={data.studentFormSchools}
          paymentMethods={data.paymentMethods}
          agents={data.agents}
          rombels={data.studentFormRombels}
          error={params.studentError}
        />
      )}

      {params.editStudent === "1" && data.selectedBranch && data.selectedStudent && (
        <StudentFormModal
          branchName={data.selectedBranch.branch_name}
          closeHref={dashboardHref(data, { editStudent: null, studentError: null })}
          redirectTo={dashboardHref(data, { editStudent: null, studentError: null })}
          years={data.activeYears}
          grades={data.grades}
          schools={data.studentFormSchools}
          paymentMethods={data.paymentMethods}
          agents={data.agents}
          rombels={data.studentFormRombels}
          student={data.selectedStudent}
          error={params.studentError}
        />
      )}

      {data.selectedBranch && ((params.addRombel === "1") || (params.editRombel && data.selectedRombel)) && (
        <RombelFormModal
          branchId={data.selectedBranch.branch_id}
          branchName={data.selectedBranch.branch_name}
          years={data.activeYears}
          grades={data.grades}
          closeHref={dashboardHref(data, { addRombel: null, editRombel: null, rombelError: null })}
          redirectTo={dashboardHref(data, { addRombel: null, editRombel: null, rombelError: null })}
          rombel={params.editRombel ? data.selectedRombel : null}
          error={params.rombelError}
        />
      )}
    </main>
  );
}

function StudentDetailModal({
  student,
  auditLogs,
  closeHref,
  historyHref,
  hasPurchaseHistory,
  editHref,
  deleteHref,
  mutateHref,
  isBackground = false,
}: {
  student: DetailRecord;
  auditLogs: AuditLogRow[];
  closeHref: string;
  historyHref: string;
  hasPurchaseHistory: boolean;
  editHref: string;
  deleteHref: string;
  mutateHref: string;
  isBackground?: boolean;
}) {
  const rows: DetailRow[] = [
    ["NIS", student.nis],
    ["Tanggal Bayar", student.payment_date],
    ["User Serial", student.user_serial],
    ["Nama Siswa", student.user_name],
    ["No HP/WA", student.user_phone],
    ["Tanggal Lahir", student.birth_date],
    ["Email", student.email],
    ["Jenjang Kelas", student.grade],
    ["Asal Sekolah", student.school_name],
    ["Nama Rombel", student.rombel_name],
    ["Nama Orang Tua", student.parents_name],
    ["No HP/WA Orang Tua", student.parents_phone],
    ["Nama Agent", student.agent_name],
    ["Metode Pembayaran", student.payment_method],
  ];

  return (
    <div
      data-modal-root
      className={`fixed inset-0 overflow-y-auto bg-slate-900/55 p-3 sm:p-5 ${
        isBackground ? "z-40" : "z-50"
      }`}
    >
      <section className="mx-auto flex h-[calc(100vh-1.5rem)] max-w-2xl flex-col overflow-hidden rounded-lg bg-white text-slate-700 shadow-xl sm:h-[calc(100vh-2.5rem)]">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 p-4">
          <h2 className="text-xl font-bold text-slate-800">Detail Siswa: {student.nis}</h2>
          <ModalCloseButton href={closeHref} />
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="divide-y divide-slate-200">
            {rows.map(([label, value], index) => (
              <div
                className={`grid grid-cols-[170px_1fr] gap-4 px-4 py-2.5 text-sm ${
                  index % 2 === 0 ? "bg-slate-100" : "bg-white"
                }`}
                key={label}
              >
                <p className="font-bold text-slate-500">{label}</p>
                <p className="text-slate-700">{String(value ?? "-")}</p>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-200 p-4">
            <h3 className="text-sm font-black text-slate-700">Riwayat Perubahan Terakhir</h3>
            <div className="mt-3 overflow-hidden rounded-md border border-slate-200">
              {auditLogs.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {auditLogs.map((log) => (
                    <div className="grid gap-1 px-3 py-2.5 text-sm" key={log.id}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-black text-slate-700">{auditActionLabel(log.action)}</p>
                        <p className="text-xs font-semibold text-slate-500">
                          {formatAuditDateTime(log.created_at)}
                        </p>
                      </div>
                      <p className="truncate text-xs font-semibold text-slate-600" title={auditChangeSummary(log.detail?.changed_fields)}>
                        {auditChangeSummary(log.detail?.changed_fields)}
                      </p>
                      <p className="text-xs font-semibold text-slate-400">{log.actor_email ?? "-"}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="px-3 py-4 text-sm font-semibold text-slate-500">
                  Belum ada riwayat perubahan untuk siswa ini.
                </p>
              )}
            </div>
          </div>
        </div>

        <footer className={`shrink-0 ${buttonGroups.modalFooter}`}>
          {hasPurchaseHistory ? (
            <Link
              className={buttonStyles.secondary}
              href={historyHref}
            >
              Riwayat Pembelian
            </Link>
          ) : (
            <button
              className={buttonStyles.disabled}
              disabled
            >
              Riwayat Pembelian
            </button>
          )}
          <Link
            className={buttonStyles.secondary}
            href={editHref}
          >
            Edit Data
          </Link>
          <Link
            className={buttonStyles.primary}
            href={mutateHref}
          >
            Mutasi
          </Link>
          <Link
            className={buttonStyles.danger}
            href={deleteHref}
          >
            Hapus
          </Link>
        </footer>
      </section>
    </div>
  );
}

function PurchaseHistoryModal({
  student,
  rows,
  closeHref,
}: {
  student: DetailRecord;
  rows: DetailRecord[];
  closeHref: string;
}) {
  return (
    <div data-modal-root className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/55 p-3 sm:p-5">
      <section className="mx-auto max-w-5xl overflow-hidden rounded-lg bg-white text-slate-700 shadow-xl">
        <header className="flex items-center justify-between gap-4 border-b border-slate-200 p-4">
          <h2 className="text-xl font-bold text-slate-800">
            Riwayat Pembelian {student.user_name}
          </h2>
          <ModalCloseButton href={closeHref} />
        </header>

        <div className="p-4">
          <div className="overflow-hidden rounded-lg border border-slate-200">
            {([
              ["Nama Siswa", student.user_name],
              ["Tanggal Lahir", student.birth_date],
              ["Email", student.email],
            ] satisfies DetailRow[]).map(([label, value]) => (
              <div className="grid grid-cols-[150px_1fr] border-b border-slate-200" key={label}>
                <p className="bg-slate-100 px-3 py-2.5 text-sm font-bold text-slate-500">{label}</p>
                <p className="px-3 py-2.5 text-sm text-slate-700">{String(value ?? "-")}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="px-3 py-3 font-bold">Tahun Ajaran</th>
                  <th className="px-3 py-3 font-bold">Jenjang Kelas</th>
                  <th className="px-3 py-3 font-bold">Asal Sekolah</th>
                  <th className="px-3 py-3 font-bold">Branch</th>
                  <th className="px-3 py-3 font-bold">Nama Agent</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr className="border-t border-slate-200" key={String(row.nis)}>
                    <td className="px-3 py-3">{row.academic_year ?? "-"}</td>
                    <td className="px-3 py-3">{row.grade ?? "-"}</td>
                    <td className="px-3 py-3">{row.school_name ?? "-"}</td>
                    <td className="px-3 py-3">{row.branch_name ?? "-"}</td>
                    <td className="px-3 py-3">{row.agent_name ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <footer aria-hidden="true" className={buttonGroups.modalFooter} />
      </section>
    </div>
  );
}

function RombelDetailModal({
  rombel,
  closeHref,
  studentsHref,
  isBackground = false,
}: {
  rombel: DetailRecord;
  closeHref: string;
  studentsHref: string;
  isBackground?: boolean;
}) {
  const rows: DetailRow[] = [
    ["Nama Rombel", rombel.rombel_name],
    ["Jenjang Kelas", rombel.grade],
    ["Tahun Ajaran", rombel.academic_year],
    ["Branch", rombel.branch_name],
    ["Jumlah Siswa", rombel.student_count],
  ];

  return (
    <div
      data-modal-root
      className={`fixed inset-0 overflow-y-auto bg-slate-900/55 p-3 sm:p-5 ${
        isBackground ? "z-40" : "z-50"
      }`}
    >
      <section className="mx-auto max-w-xl overflow-hidden rounded-lg bg-white text-slate-700 shadow-xl">
        <header className="flex items-center justify-between gap-4 border-b border-slate-200 p-4">
          <h2 className="text-xl font-bold text-slate-800">Detail Rombel</h2>
          <ModalCloseButton href={closeHref} />
        </header>
        <div className="divide-y divide-slate-200">
          {rows.map(([label, value], index) => (
            <div
              className={`grid grid-cols-[150px_1fr] gap-4 px-4 py-2.5 text-sm ${
                index % 2 === 0 ? "bg-slate-100" : "bg-white"
              }`}
              key={label}
            >
              <p className="font-bold text-slate-500">{label}</p>
              <p className="truncate text-slate-700" title={String(value ?? "-")}>
                {String(value ?? "-")}
              </p>
            </div>
          ))}
        </div>
        <footer className={buttonGroups.modalFooter}>
          <Link
            className={buttonStyles.primary}
            href={studentsHref}
          >
            Daftar Siswa
          </Link>
        </footer>
      </section>
    </div>
  );
}

function RombelStudentsModal({
  rombel,
  rows,
  closeHref,
}: {
  rombel: DetailRecord;
  rows: DetailRecord[];
  closeHref: string;
}) {
  return (
    <div data-modal-root className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/55 p-3 sm:p-5">
      <section className="mx-auto max-w-3xl overflow-hidden rounded-lg bg-white text-slate-700 shadow-xl">
        <header className="flex items-center justify-between gap-4 border-b border-slate-200 p-4">
          <h2 className="text-xl font-bold text-slate-800">
            Daftar Siswa {rombel.rombel_name}
          </h2>
          <ModalCloseButton href={closeHref} />
        </header>
        <div className="max-h-[520px] overflow-y-auto px-4 pb-4">
          <table className="w-full table-fixed border-separate border-spacing-0 text-left text-sm">
            <thead className="text-slate-600">
              <tr>
                <th className="sticky top-0 z-20 w-[20%] border-b border-slate-200 bg-slate-100 px-3 py-2 font-bold shadow-[0_1px_0_0_#e2e8f0]">
                  NIS
                </th>
                <th className="sticky top-0 z-20 w-[35%] border-b border-slate-200 bg-slate-100 px-3 py-2 font-bold shadow-[0_1px_0_0_#e2e8f0]">
                  Nama Siswa
                </th>
                <th className="sticky top-0 z-20 w-[45%] border-b border-slate-200 bg-slate-100 px-3 py-2 font-bold shadow-[0_1px_0_0_#e2e8f0]">
                  Asal Sekolah
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr className="border-t border-slate-200" key={String(row.nis)}>
                  <td className="truncate px-3 py-2 text-[#2f6696]">{row.nis ?? "-"}</td>
                  <td className="truncate px-3 py-2 text-slate-600" title={String(row.user_name ?? "")}>
                    {row.user_name ?? "-"}
                  </td>
                  <td className="truncate px-3 py-2 text-slate-600" title={String(row.school_name ?? "")}>
                    {row.school_name ?? "-"}
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td className="px-3 py-8 text-center font-semibold text-slate-500" colSpan={3}>
                    Belum ada siswa di rombel ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <footer aria-hidden="true" className={buttonGroups.modalFooter} />
      </section>
    </div>
  );
}

function DeleteRombelConfirmModal({
  rombel,
  closeHref,
  redirectTo,
}: {
  rombel: DetailRecord;
  closeHref: string;
  redirectTo: string;
}) {
  return (
    <div data-modal-root className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/55 p-3 sm:p-5">
      <section className="mx-auto max-w-lg overflow-hidden rounded-lg bg-white text-slate-700 shadow-xl">
        <header className="flex items-center justify-between gap-4 border-b border-slate-200 p-4">
          <h2 className="text-xl font-bold text-slate-800">Hapus Rombel</h2>
          <ModalCloseButton href={closeHref} />
        </header>
        <div className="grid gap-3 p-4 text-sm">
          <p className="font-semibold text-slate-600">
            Yakin ingin menghapus rombel ini?
          </p>
          <div className="overflow-hidden rounded-lg border border-slate-200">
            {([
              ["Nama Rombel", rombel.rombel_name],
              ["Jenjang Kelas", rombel.grade],
              ["Tahun Ajaran", rombel.academic_year],
              ["Jumlah Siswa", rombel.student_count],
            ] satisfies DetailRow[]).map(([label, value]) => (
              <div className="grid grid-cols-[130px_1fr] border-b border-slate-200 last:border-b-0" key={label}>
                <p className="bg-slate-100 px-3 py-2.5 font-bold text-slate-500">{label}</p>
                <p className="px-3 py-2.5 text-slate-700">{String(value ?? "-")}</p>
              </div>
            ))}
          </div>
        </div>
        <footer className={buttonGroups.modalFooter}>
          <form action={deleteRombel}>
            <input name="rombel_id" type="hidden" value={String(rombel.rombel_id)} />
            <input name="redirect_to" type="hidden" value={redirectTo} />
            <SubmitButton
              className={buttonStyles.danger}
              pendingText="Menghapus"
            >
              Hapus
            </SubmitButton>
          </form>
        </footer>
      </section>
    </div>
  );
}

function DeleteStudentConfirmModal({
  student,
  closeHref,
  redirectTo,
}: {
  student: DetailRecord;
  closeHref: string;
  redirectTo: string;
}) {
  return (
    <div data-modal-root className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/55 p-3 sm:p-5">
      <section className="mx-auto max-w-lg overflow-hidden rounded-lg bg-white text-slate-700 shadow-xl">
        <header className="flex items-center justify-between gap-4 border-b border-slate-200 p-4">
          <h2 className="text-xl font-bold text-slate-800">Hapus Data Siswa</h2>
          <ModalCloseButton href={closeHref} />
        </header>
        <div className="grid gap-3 p-4 text-sm">
          <p className="font-semibold text-slate-600">
            Yakin ingin menghapus data siswa ini dari database?
          </p>
          <div className="overflow-hidden rounded-lg border border-slate-200">
            {([
              ["NIS", student.nis],
              ["Nama Siswa", student.user_name],
              ["Tahun Ajaran", student.academic_year],
              ["Branch", student.branch_name],
            ] satisfies DetailRow[]).map(([label, value]) => (
              <div className="grid grid-cols-[130px_1fr] border-b border-slate-200 last:border-b-0" key={label}>
                <p className="bg-slate-100 px-3 py-2.5 font-bold text-slate-500">{label}</p>
                <p className="px-3 py-2.5 text-slate-700">{String(value ?? "-")}</p>
              </div>
            ))}
          </div>
        </div>
        <footer className={buttonGroups.modalFooter}>
          <form action={deleteStudent}>
            <input name="nis" type="hidden" value={String(student.nis)} />
            <input name="redirect_to" type="hidden" value={redirectTo} />
            <SubmitButton
              className={buttonStyles.danger}
              pendingText="Menghapus"
            >
              Hapus
            </SubmitButton>
          </form>
        </footer>
      </section>
    </div>
  );
}

function MutateStudentModal({
  student,
  branches,
  closeHref,
  redirectTo,
}: {
  student: DetailRecord;
  branches: Branch[];
  closeHref: string;
  redirectTo: string;
}) {
  const originBranchId = Number(student.branch_id);
  const destinationBranches = branches.filter((branch) => branch.branch_id !== originBranchId);
  const originBranchName = String(student.branch_name ?? "-");
  const currentRombelName = String(student.rombel_name ?? "Belum ada rombel");

  return (
    <div data-modal-root className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/55 p-3 sm:p-5">
      <section className="mx-auto max-w-lg overflow-hidden rounded-lg bg-white text-slate-700 shadow-xl">
        <header className="flex items-center justify-between gap-4 border-b border-slate-200 p-4">
          <h2 className="text-xl font-bold text-slate-800">Mutasi Siswa</h2>
          <ModalCloseButton href={closeHref} />
        </header>
        <form action={mutateStudent}>
          <div className="grid gap-4 p-4">
            <input name="nis" type="hidden" value={String(student.nis)} />
            <input name="redirect_to" type="hidden" value={redirectTo} />
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
              <p className="font-black text-slate-700">{String(student.user_name ?? "-")}</p>
              <p className="mt-1 font-semibold text-slate-500">
                Dari {originBranchName} · Rombel saat ini: {currentRombelName}
              </p>
            </div>
            <label className="grid gap-2 text-sm font-bold text-slate-500">
              Mutasi siswa ke cabang
              <select
                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-normal text-slate-700 outline-none"
                name="branch_id"
                required
                defaultValue=""
              >
                <option value="" disabled>
                  Pilih cabang tujuan
                </option>
                {destinationBranches.map((branch) => (
                  <option key={branch.branch_id} value={branch.branch_id}>
                    {branch.branch_name}
                  </option>
                ))}
              </select>
            </label>
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
            Setelah mutasi, rombel siswa akan dikosongkan dan perlu dipilih ulang di cabang tujuan.
          </div>
        </div>
        <footer className={buttonGroups.modalFooter}>
          <SubmitButton
            className={buttonStyles.primary}
            pendingText="Memutasi"
            >
              Mutasi
            </SubmitButton>
          </footer>
        </form>
      </section>
    </div>
  );
}

function MutationSuccessModal({ closeHref }: { closeHref: string }) {
  return (
    <div data-modal-root className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/55 p-3 sm:p-5">
      <section className="mx-auto max-w-md overflow-hidden rounded-lg bg-white text-slate-700 shadow-xl">
        <header className="flex items-center justify-between gap-4 border-b border-slate-200 p-4">
          <h2 className="text-xl font-bold text-slate-800">Informasi</h2>
          <ModalCloseButton href={closeHref} />
        </header>
        <div className="p-4">
          <p className="text-sm font-semibold text-slate-600">Siswa berhasil dimutasi</p>
        </div>
        <footer aria-hidden="true" className={buttonGroups.modalFooter} />
      </section>
    </div>
  );
}

function SchoolDetailModal({
  school,
  yearCounts = [],
  closeHref,
}: {
  school: DetailRecord;
  yearCounts?: { academic_year: string; student_count: number }[];
  closeHref: string;
}) {
  const rows: DetailRow[] = [
    ["NPSN", school.npsn],
    ["Nama Sekolah", school.school_name],
    ["Level", school.level],
    ["Status", school.school_status],
    ["Alamat", school.address],
    ["Kecamatan", school.district],
    ["Kota Kabupaten", school.city],
    ["Provinsi", school.province],
    ["Jumlah Siswa", school.student_count],
  ];

  return (
    <div data-modal-root className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/55 p-3 sm:p-5">
      <section className="mx-auto max-w-2xl overflow-hidden rounded-lg bg-white text-slate-700 shadow-xl">
        <header className="flex items-center justify-between gap-4 border-b border-slate-200 p-4">
          <h2 className="text-xl font-bold text-slate-800">Detail Sekolah</h2>
          <ModalCloseButton href={closeHref} />
        </header>
        <div className="divide-y divide-slate-200">
          {rows.map(([label, value], index) => (
            <div
              className={`grid grid-cols-[150px_1fr] gap-4 px-4 py-2.5 text-sm ${
                index % 2 === 0 ? "bg-slate-100" : "bg-white"
              }`}
              key={label}
            >
              <p className="font-bold text-slate-500">{label}</p>
              <p className="text-slate-700">{String(value ?? "-")}</p>
            </div>
          ))}
          {yearCounts.length > 0 && (
            <div className="px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Rincian per Tahun Ajaran
              </p>
              <div className="mt-3 grid gap-2">
                {yearCounts.map((item) => (
                  <div
                    className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm"
                    key={item.academic_year}
                  >
                    <span className="font-semibold text-slate-600">{item.academic_year}</span>
                    <span className="font-bold text-slate-800">{item.student_count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <footer aria-hidden="true" className={buttonGroups.modalFooter} />
      </section>
    </div>
  );
}

function SchoolLookupModal({
  branchId,
  branchName,
  academicYear,
  redirectTo,
  closeHref,
  lookupNpsn,
  school,
  alreadyRegistered,
}: {
  branchId: number | null;
  branchName: string;
  academicYear: string;
  redirectTo: string;
  closeHref: string;
  lookupNpsn: string;
  school: DetailRecord | null;
  alreadyRegistered: boolean;
}) {
  const rows: DetailRow[] = school
    ? [
        ["NPSN", school.npsn],
        ["Nama Sekolah", school.name],
        ["Level", school.level],
        ["Status", school.status],
        ["Alamat", school.address],
        ["Kecamatan", school.district],
        ["Kota Kabupaten", school.city],
        ["Provinsi", school.province],
      ]
    : [];

  return (
    <div data-modal-root className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/55 p-3 sm:p-5">
      <section className="mx-auto max-w-2xl overflow-hidden rounded-lg bg-white text-slate-700 shadow-xl">
        <header className="flex items-center justify-between gap-4 border-b border-slate-200 p-4">
          <h2 className="text-xl font-bold text-slate-800">Cari Sekolah Jawa Timur</h2>
          <ModalCloseButton href={closeHref} />
        </header>
        <div className="p-4">
          <form className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <input name="addSchool" type="hidden" value="1" />
            {branchId && <input name="branch" type="hidden" value={branchId} />}
            <input name="year" type="hidden" value={academicYear} />
            <label className="grid gap-2 text-sm font-bold text-slate-500">
              NPSN
              <input
                className="h-10 rounded-md border border-slate-300 px-3 text-sm font-normal text-slate-700 outline-none"
                name="lookupNpsn"
                defaultValue={lookupNpsn}
                maxLength={8}
                placeholder="Masukkan NPSN"
              />
            </label>
            <button className={buttonStyles.primary}>
              Cari
            </button>
          </form>

          {lookupNpsn && !school && (
            <p className="mt-4 text-sm font-semibold text-red-600">
              NPSN tidak ditemukan di master sekolah.
            </p>
          )}

          {school && (
            <>
              <p className="mt-4 text-sm font-semibold text-slate-500">
                {alreadyRegistered
                  ? `Sekolah sudah terdaftar di Data Sekolah ${branchName}.`
                  : `Data sekolah ditemukan. Klik Daftarkan untuk menambahkan ke Data Sekolah ${branchName}.`}
              </p>
              <div className="mt-4 divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200">
                {rows.map(([label, value], index) => (
                  <div
                    className={`grid grid-cols-[150px_1fr] gap-4 px-4 py-2.5 text-sm ${
                      index % 2 === 0 ? "bg-slate-100" : "bg-white"
                    }`}
                    key={label}
                  >
                    <p className="font-bold text-slate-500">{label}</p>
                    <p className="text-slate-700">{String(value ?? "-")}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        <footer className={buttonGroups.modalFooter}>
          <form action={createBranchSchool}>
            {branchId && <input name="branch_id" type="hidden" value={branchId} />}
            <input name="npsn" type="hidden" value={lookupNpsn} />
            <input name="redirect_to" type="hidden" value={redirectTo} />
            <SubmitButton
              className={school && !alreadyRegistered ? buttonStyles.primary : buttonStyles.disabled}
              disabled={!school || alreadyRegistered}
              pendingText="Mendaftarkan"
            >
              Daftarkan
            </SubmitButton>
          </form>
        </footer>
      </section>
    </div>
  );
}
