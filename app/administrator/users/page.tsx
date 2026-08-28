import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { deleteAppUser, updateUserAccess } from "@/app/auth/actions";
import {
  type BranchRow,
  type PositionRow,
  type RoleRow,
  type UserBranchRow,
  type UserRow,
  isFullAdminRole,
  isGuestPositionName,
  requireAdminContext,
} from "@/app/administrator/admin-utils";
import { PageHeader } from "@/app/administrator/page-header";
import { UserPasswordCard } from "@/app/administrator/user-password-card";
import { UserSearchBox } from "@/app/administrator/user-search-box";
import { AddUserModal } from "@/app/administrator/add-user-modal";
import { SalesAgentCheckbox } from "@/app/administrator/sales-agent-checkbox";
import { BranchAccessDropdown } from "@/app/components/branch-access-dropdown";
import { buttonStyles } from "@/app/components/button-styles";
import { GeneratePasswordButton } from "@/app/components/generate-password-button";
import { SubmitButton } from "@/app/components/submit-button";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ addUser?: string; error?: string; q?: string; success?: string }>;
}) {
  const params = await searchParams;
  const searchQuery = (params.q ?? "").trim().toLowerCase();
  const { dataSupabase, profile } = await requireAdminContext();
  const isFullAdmin = isFullAdminRole(profile.role_id);
  const [
    { data: users },
    { data: allRoles },
    { data: allPositions },
    { data: branches },
    { data: userBranches },
    { data: linkedAgents },
    { data: limitedRoleFilters },
    { data: limitedPositionFilters },
  ] = await Promise.all([
      dataSupabase
        .from("t_app_user")
        .select("id, name, email, position_id, role_id")
        .order("email"),
      dataSupabase.from("t_role").select("role_id, role_name").order("role_name"),
      dataSupabase.from("t_position").select("position_id, position_name").order("position_name"),
      dataSupabase
        .from("t_branch")
        .select("branch_id, branch_name, region_id, t_region(region_name)")
        .order("region_id")
        .order("branch_name"),
      dataSupabase.from("t_app_user_branch").select("user_id, branch_id"),
      dataSupabase
        .from("t_agent")
        .select("agent_id, agent_name, agent_email, app_user_id, branch_id, is_active")
        .order("agent_name"),
      dataSupabase.from("t_admin_limited_role_filter").select("role_id"),
      dataSupabase.from("t_admin_limited_position_filter").select("position_id"),
    ]);
  const usersList = (users ?? []) as UserRow[];
  const allRolesList = (allRoles ?? []) as RoleRow[];
  const allPositionsList = (allPositions ?? []) as PositionRow[];
  const limitedRoleIds = new Set(((limitedRoleFilters ?? []) as { role_id: string }[]).map((row) => row.role_id));
  const limitedPositionIds = new Set(
    ((limitedPositionFilters ?? []) as { position_id: number }[]).map((row) => row.position_id),
  );
  const rolesList = isFullAdmin
    ? allRolesList
    : allRolesList.filter(
        (role) => limitedRoleIds.has(role.role_id) && !["admin", "admin_limited"].includes(role.role_id),
      );
  const positionsList = isFullAdmin
    ? allPositionsList
    : allPositionsList.filter(
        (position) =>
          limitedPositionIds.has(position.position_id) && !isGuestPositionName(position.position_name),
      );
  const branchesList = (branches ?? []) as BranchRow[];
  const accessByUser = new Map<string, Set<number>>();
  ((userBranches ?? []) as UserBranchRow[]).forEach((row) => {
    const access = accessByUser.get(row.user_id) ?? new Set<number>();
    access.add(row.branch_id);
    accessByUser.set(row.user_id, access);
  });
  const activeAgentUserIds = new Set(
    ((linkedAgents ?? []) as { app_user_id: string | null; is_active: boolean }[])
      .filter((agent) => agent.app_user_id && agent.is_active)
      .map((agent) => agent.app_user_id as string),
  );
  const activeUnlinkedAgents = ((linkedAgents ?? []) as {
    agent_id: number;
    agent_name: string;
    agent_email: string | null;
    app_user_id: string | null;
    branch_id: number | null;
    is_active: boolean;
  }[]).filter((agent) => agent.is_active && agent.app_user_id === null && agent.branch_id !== null);
  const actorBranchIds = accessByUser.get(profile.id) ?? new Set<number>();
  const actorRegionIds = new Set(
    branchesList
      .filter((branch) => actorBranchIds.has(branch.branch_id) && typeof branch.region_id === "number")
      .map((branch) => branch.region_id as number),
  );
  const modalBranchesList = isFullAdmin
    ? branchesList
    : branchesList.filter(
        (branch) =>
          branch.branch_id !== 100 &&
          typeof branch.region_id === "number" &&
          actorRegionIds.has(branch.region_id),
      );
  const visibleUsersList = isFullAdmin
    ? usersList
    : usersList.filter((appUser) => {
        if (!limitedRoleIds.has(appUser.role_id)) {
          return false;
        }

        if (!appUser.position_id || !limitedPositionIds.has(appUser.position_id)) {
          return false;
        }

        const userPosition = allPositionsList.find((position) => position.position_id === appUser.position_id);

        if (isGuestPositionName(userPosition?.position_name)) {
          return false;
        }

        const userAccess = accessByUser.get(appUser.id);

        if (!userAccess || userAccess.size === 0) {
          return false;
        }

        return [...userAccess].some((branchId) => actorBranchIds.has(branchId));
      });
  const filteredUsersList = searchQuery
    ? visibleUsersList.filter((appUser) => {
        const roleLabel =
          allRolesList.find((role) => role.role_id === appUser.role_id)?.role_name ?? appUser.role_id;
        const positionLabel =
          allPositionsList.find((position) => position.position_id === appUser.position_id)?.position_name ?? "";

        return [appUser.name, appUser.email, roleLabel, positionLabel]
          .filter(Boolean)
          .some((value) => value?.toLowerCase().includes(searchQuery));
      })
    : visibleUsersList;

  return (
    <>
      <PageHeader
        description="Edit role, posisi, password sementara, dan cabang yang bisa diakses setiap user."
        title="User"
      />
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
      {params.success === "user-created" && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          User berhasil ditambahkan. Password default: Ruangguru2026.
        </div>
      )}
      {params.success === "user-deleted" && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          User berhasil dihapus.
        </div>
      )}
      {params.success?.startsWith("bulk-") && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          Bulk import selesai. Berhasil: {params.success.replace("bulk-", "")} user.
        </div>
      )}

      <section className="flex h-[calc(100vh-190px)] min-h-0 flex-col overflow-hidden rounded-md border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold">Daftar User</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Kelola role, posisi, dan cabang untuk setiap user.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <UserSearchBox initialQuery={params.q ?? ""} />
            <Link className={buttonStyles.primary} href="/administrator/users?addUser=1">
              <Plus className="size-4" aria-hidden="true" />
              User
            </Link>
          </div>
        </div>
        <div className="grid min-h-0 gap-2 overflow-y-auto p-4">
          {filteredUsersList.map((appUser) => {
            const userAccess = accessByUser.get(appUser.id) ?? new Set<number>();
            const selectedBranchCount = userAccess.size;
            const roleLabel =
              allRolesList.find((role) => role.role_id === appUser.role_id)?.role_name ?? appUser.role_id;
            const positionLabel =
              allPositionsList.find((position) => position.position_id === appUser.position_id)?.position_name ??
              "Belum ada posisi";

            return (
              <details className="group rounded-md border border-slate-200 bg-white" key={appUser.id}>
                <summary className="grid cursor-pointer list-none gap-3 px-4 py-3 hover:bg-white sm:grid-cols-[minmax(0,1fr)_190px_150px_130px_90px] sm:items-center [&::-webkit-details-marker]:hidden">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-800">{appUser.name ?? appUser.email}</p>
                    <p className="mt-1 truncate text-xs font-semibold text-slate-500">{appUser.email}</p>
                  </div>
                  {isFullAdmin ? <UserPasswordCard userId={appUser.id} /> : <span />}
                  <span className="truncate rounded-full bg-[#e8f1f8] px-2.5 py-1 text-center text-xs font-bold text-[#2f6696]">
                    {roleLabel}
                  </span>
                  <span className="rounded-full bg-[#e8f1f8] px-2.5 py-1 text-center text-xs font-bold text-[#2f6696]">
                    {selectedBranchCount} branch
                  </span>
                  <span className="text-right text-xs font-bold text-[#2f6696] group-open:text-slate-500">Edit</span>
                </summary>
                <form
                  action={updateUserAccess}
                  className="grid grid-cols-[260px_180px_minmax(260px,1fr)_86px_112px_96px_96px] items-end gap-3 border-t border-slate-200 bg-white p-4"
                  id={`user-access-${appUser.id}`}
                >
                  <input name="user_id" type="hidden" value={appUser.id} />
                  <label className="grid gap-1 text-xs font-bold text-slate-500">
                    Posisi
                    <select
                      className="h-9 w-full min-w-0 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none"
                      defaultValue={appUser.position_id ?? ""}
                      name="position_id"
                    >
                      <option value="">Pilih posisi</option>
                      {positionsList.map((position) => (
                        <option key={position.position_id} value={position.position_id}>
                          {position.position_name}
                        </option>
                      ))}
                    </select>
                    <span className="sr-only">Posisi saat ini: {positionLabel}</span>
                  </label>
                  <label className="grid gap-1 text-xs font-bold text-slate-500">
                    Role
                    <select
                      className="h-9 w-full min-w-0 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none"
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
                  <label className="grid gap-1 text-xs font-bold text-slate-500">
                    Akses Branch
                    <BranchAccessDropdown
                      branches={isFullAdmin ? branchesList : modalBranchesList}
                      formId={`user-access-${appUser.id}`}
                      selectedBranchIds={[...userAccess]}
                    />
                  </label>
                  <SalesAgentCheckbox
                    defaultChecked={activeAgentUserIds.has(appUser.id)}
                    formId={`user-access-${appUser.id}`}
                    initialBranchCount={selectedBranchCount}
                  />
                  {isFullAdmin ? <GeneratePasswordButton userId={appUser.id} /> : <span />}
                  <SubmitButton className={buttonStyles.formCompactPrimary} pendingText="Simpan">
                    Simpan
                  </SubmitButton>
                  {isFullAdmin && (
                    <SubmitButton
                      className={buttonStyles.formCompactDanger}
                      form={`delete-user-${appUser.id}`}
                      pendingText="Hapus"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                      Hapus
                    </SubmitButton>
                  )}
                </form>
                {isFullAdmin && (
                  <form action={deleteAppUser} id={`delete-user-${appUser.id}`}>
                    <input name="user_id" type="hidden" value={appUser.id} />
                  </form>
                )}
              </details>
            );
          })}
          {filteredUsersList.length === 0 && (
            <p className="rounded-md border border-slate-200 bg-slate-50 px-4 py-5 text-sm font-semibold text-slate-500">
              User tidak ditemukan.
            </p>
          )}
        </div>
      </section>
      {params.addUser === "1" && (
        <AddUserModal
          allowBulk={isFullAdmin}
          agents={activeUnlinkedAgents.map((agent) => ({
            agent_id: agent.agent_id,
            agent_email: agent.agent_email,
            agent_name: agent.agent_name,
            branch_id: agent.branch_id as number,
          }))}
          branches={modalBranchesList}
          closeHref="/administrator/users"
          positions={positionsList}
          roles={rolesList}
        />
      )}
    </>
  );
}
