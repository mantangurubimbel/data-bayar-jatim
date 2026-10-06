import Link from "next/link";
import { MoveRight, Plus } from "lucide-react";
import {
  type BranchRow,
  type AgentRow,
  type UserBranchRow,
  isFullAdminRole,
  requireAdminContext,
} from "@/app/administrator/admin-utils";
import { AgentStatusSwitch } from "@/app/administrator/agents/agent-status-switch";
import { AddAgentModal } from "@/app/administrator/agents/add-agent-modal";
import { MoveAgentModal } from "@/app/administrator/agents/move-agent-modal";
import { AgentStatusFilter, type AgentStatusFilterValue } from "@/app/administrator/agents/status-filter";
import { buttonStyles } from "@/app/components/button-styles";
import { PageHeader } from "@/app/administrator/page-header";

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminAgentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    addAgent?: string;
    error?: string;
    moveAgent?: string;
    status?: string;
    success?: string;
  }>;
}) {
  const params = await searchParams;
  const selectedStatus: AgentStatusFilterValue =
    params.status === "active" || params.status === "inactive" ? params.status : "all";
  const { dataSupabase, profile } = await requireAdminContext();
  const isFullAdmin = isFullAdminRole(profile.role_id);
  const [{ data: userBranches }, { data: agents }, { data: branches }] = await Promise.all([
    dataSupabase.from("t_app_user_branch").select("user_id, branch_id"),
    (selectedStatus === "all"
      ? dataSupabase
          .from("t_agent")
          .select("agent_id, agent_name, branch_id, app_user_id, is_active, t_branch(branch_name)")
          .order("agent_name")
      : dataSupabase
          .from("t_agent")
          .select("agent_id, agent_name, branch_id, app_user_id, is_active, t_branch(branch_name)")
          .eq("is_active", selectedStatus === "active")
          .order("agent_name")),
    dataSupabase
      .from("t_branch")
      .select("branch_id, branch_name, region_id, t_region(region_name)")
      .order("region_id")
      .order("branch_name"),
  ]);
  const actorBranchIds = new Set(
    ((userBranches ?? []) as UserBranchRow[])
      .filter((row) => row.user_id === profile.id)
      .map((row) => row.branch_id),
  );
  const agentsList = ((agents ?? []) as AgentRow[]).filter(
    (agent) => isFullAdmin || agent.branch_id === null || actorBranchIds.has(agent.branch_id),
  );
  const branchesList = (branches ?? []) as BranchRow[];
  const modalBranches = isFullAdmin
    ? branchesList
    : branchesList.filter((branch) => actorBranchIds.has(branch.branch_id));
  const selectedMoveAgent = agentsList.find((agent) => String(agent.agent_id) === params.moveAgent) ?? null;

  return (
    <>
      <PageHeader description="Kelola status agent berdasarkan akses branch." title="Agent" />
      {params.error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {params.error}
        </div>
      )}
      {params.success === "1" && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          Status agent berhasil diperbarui.
        </div>
      )}
      {params.success === "agent-created" && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          Agent berhasil ditambahkan.
        </div>
      )}
      {params.success === "agent-moved" && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          Branch agent berhasil dipindahkan.
        </div>
      )}
      <section className="overflow-hidden rounded-md border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-bold">Daftar Agent</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">Agent yang terlihat mengikuti akses branch user.</p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-end">
            <AgentStatusFilter value={selectedStatus} />
            <Link
              className={buttonStyles.primary}
              href={`/administrator/agents?status=${selectedStatus}&addAgent=1`}
              scroll={false}
            >
              <Plus className="size-4" aria-hidden="true" />
              Tambah Agent
            </Link>
          </div>
        </div>
        <div className="max-h-[calc(100vh-270px)] min-h-[360px] overflow-auto">
          <table className="w-full min-w-[640px] text-left text-sm font-normal text-slate-700">
            <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 font-bold">Nama Agent</th>
                <th className="px-4 py-3 font-bold">Branch</th>
                <th className="px-4 py-3 text-right font-bold">Status</th>
                <th className="px-4 py-3 text-right font-bold">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {agentsList.map((agent) => {
                const branch = firstRelation(agent.t_branch);
                return (
                  <tr className="border-t border-slate-200" key={agent.agent_id}>
                    <td className="px-4 py-3">{agent.agent_name}</td>
                    <td className="px-4 py-3">{branch?.branch_name ?? "-"}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <AgentStatusSwitch
                          agentId={agent.agent_id}
                          isActive={agent.is_active}
                          status={selectedStatus}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <Link
                          aria-label={`Pindah branch ${agent.agent_name}`}
                          className={buttonStyles.secondarySmall}
                          href={`/administrator/agents?status=${selectedStatus}&moveAgent=${agent.agent_id}`}
                          scroll={false}
                          title="Pindah branch"
                        >
                          <MoveRight className="size-3.5" aria-hidden="true" />
                          Pindah
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {agentsList.length === 0 && (
                <tr className="border-t border-slate-200">
                  <td className="px-4 py-5 text-center" colSpan={4}>
                    Tidak ada agent untuk filter ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      {params.addAgent === "1" && (
        <AddAgentModal
          branches={modalBranches}
          closeHref={`/administrator/agents?status=${selectedStatus}`}
          status={selectedStatus}
        />
      )}
      {selectedMoveAgent && (
        <MoveAgentModal
          agent={selectedMoveAgent}
          branches={modalBranches}
          closeHref={`/administrator/agents?status=${selectedStatus}`}
          status={selectedStatus}
        />
      )}
    </>
  );
}
