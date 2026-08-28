import { redirect } from "next/navigation";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server";

export const adminRoleIds = ["admin", "admin_limited"] as const;
export type AdminRoleId = (typeof adminRoleIds)[number];

export type UserRow = {
  id: string;
  name: string | null;
  email: string | null;
  position_id: number | null;
  role_id: string;
};

export type RoleRow = {
  role_id: string;
  role_name: string;
};

export type PositionRow = {
  position_id: number;
  position_name: string;
};

export type AdminLimitedRoleFilterRow = {
  role_id: string;
};

export type AdminLimitedPositionFilterRow = {
  position_id: number;
};

export type BranchRow = {
  branch_id: number;
  branch_name: string;
  region_id?: number;
  t_region?: { region_name: string | null } | { region_name: string | null }[] | null;
};

export type UserBranchRow = {
  user_id: string;
  branch_id: number;
};

export type DashboardSummaryRow = {
  branch_id: number;
  branch_name: string | null;
  academic_year: string | null;
  active_students: number | null;
  incomplete_students: number | null;
  students_without_rombel: number | null;
};

export type AcademicYearRow = {
  academic_year: string;
  is_active: boolean;
};

export type RecentStudentActivityRow = {
  nis: string;
  user_name: string | null;
  branch_id: number | null;
  branch_name: string | null;
  academic_year: string | null;
  status: string | null;
  operator_email: string | null;
  updated_at: string | null;
};

export type StudentAuditLogRow = {
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

export type SheetSyncLogRow = {
  id: number;
  nis: string;
  action: string;
  status: string;
  actor_email: string | null;
  attempts: number | null;
  error_message: string | null;
  last_attempt_at: string | null;
};

export type BranchDashboardMetric = {
  branch_id: number;
  branch_name: string;
  total_students: number;
  incomplete_students: number;
  students_without_rombel: number;
  user_count: number;
};

export type AgentRow = {
  agent_id: number;
  agent_name: string;
  branch_id: number | null;
  is_active: boolean;
  t_branch?: { branch_name: string | null } | { branch_name: string | null }[] | null;
};

export function isAdminRole(roleId: string | null | undefined) {
  return adminRoleIds.includes(roleId as AdminRoleId);
}

export function isFullAdminRole(roleId: string | null | undefined) {
  return roleId === "admin";
}

export function isGuestPositionName(positionName: string | null | undefined) {
  return positionName?.trim().toLowerCase() === "guest";
}

export const numberFormatter = new Intl.NumberFormat("id-ID");

export function formatNumber(value: number) {
  return numberFormatter.format(value);
}

export function formatDateTime(value: string | null) {
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

export function formatChangedFields(
  changedFields?: Record<string, { before: string | number | null; after: string | number | null }>,
) {
  const entries = Object.entries(changedFields ?? {}).slice(0, 2);

  if (entries.length === 0) {
    return "-";
  }

  return entries
    .map(([field, change]) => `${field}: ${String(change.before ?? "-")} -> ${String(change.after ?? "-")}`)
    .join("; ");
}

export function getBranchMetrics({
  branches,
  dashboardSummary,
  userBranches,
}: {
  branches: BranchRow[];
  dashboardSummary: DashboardSummaryRow[];
  userBranches: UserBranchRow[];
}) {
  const userCountByBranch = new Map<number, number>();

  userBranches.forEach((row) => {
    userCountByBranch.set(row.branch_id, (userCountByBranch.get(row.branch_id) ?? 0) + 1);
  });

  const dashboardByBranch = new Map(
    dashboardSummary.map((row) => [
      row.branch_id,
      {
        branch_id: row.branch_id,
        branch_name: row.branch_name ?? `Branch ${row.branch_id}`,
        total_students: row.active_students ?? 0,
        incomplete_students: row.incomplete_students ?? 0,
        students_without_rombel: row.students_without_rombel ?? 0,
        user_count: userCountByBranch.get(row.branch_id) ?? 0,
      },
    ]),
  );

  branches.forEach((branch) => {
    if (!dashboardByBranch.has(branch.branch_id)) {
      dashboardByBranch.set(branch.branch_id, {
        branch_id: branch.branch_id,
        branch_name: branch.branch_name,
        total_students: 0,
        incomplete_students: 0,
        students_without_rombel: 0,
        user_count: userCountByBranch.get(branch.branch_id) ?? 0,
      });
    }
  });

  return [...dashboardByBranch.values()].sort((first, second) =>
    first.branch_name.localeCompare(second.branch_name),
  );
}

export async function requireAdminContext() {
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
    .select("id, role_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!isAdminRole(currentProfile?.role_id)) {
    redirect("/");
  }

  return {
    dataSupabase,
    profile: {
      id: user.id,
      role_id: currentProfile?.role_id as AdminRoleId,
    },
    user,
  };
}

export async function requireAdminSupabase() {
  const { dataSupabase } = await requireAdminContext();
  return dataSupabase;
}
