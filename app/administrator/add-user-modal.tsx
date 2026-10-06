"use client";

import { Contact, Plus, Upload, UserPlus, X } from "lucide-react";
import { useState } from "react";
import { bulkImportUsers, createSingleUser, createUserFromAgent } from "@/app/auth/actions";
import { type BranchRow, type PositionRow, type RoleRow } from "@/app/administrator/admin-utils";
import { BranchAccessTable } from "@/app/administrator/branch-access-table";
import { SalesAgentCheckbox } from "@/app/administrator/sales-agent-checkbox";
import { buttonStyles } from "@/app/components/button-styles";
import { ModalCloseLink } from "@/app/components/modal-close-link";
import { SubmitButton } from "@/app/components/submit-button";

type TabKey = "agent" | "single" | "bulk";

const inputClass =
  "h-9 min-w-0 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-[#2f6696] focus:ring-2 focus:ring-[#2f6696]/20";
const labelClass = "grid gap-1 text-xs font-bold text-slate-500";

export function AddUserModal({
  allowBulk,
  agents,
  branches,
  closeHref,
  positions,
  roles,
}: {
  allowBulk: boolean;
  agents: { agent_id: number; agent_name: string; agent_email: string | null; branch_id: number }[];
  branches: BranchRow[];
  closeHref: string;
  positions: PositionRow[];
  roles: RoleRow[];
}) {
  const [activeTab, setActiveTab] = useState<TabKey>("single");
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const formId = "modal-create-user-form";
  const selectedAgent = agents.find((agent) => String(agent.agent_id) === selectedAgentId) ?? null;

  return (
    <div data-modal-root className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/55 p-3 sm:p-5">
      <div className="mx-auto grid min-h-full max-w-5xl place-items-center">
        <div className="w-full overflow-hidden rounded-md border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Tambah User</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">Password default: Ruangguru2026</p>
            </div>
            <ModalCloseLink aria-label="Tutup modal" className={buttonStyles.iconClose} href={closeHref} title="Tutup">
              <X className="size-4" aria-hidden="true" />
            </ModalCloseLink>
          </div>

          {(allowBulk || agents.length > 0) && (
            <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
              <div className="inline-flex rounded-md border border-slate-200 bg-white p-1">
                {agents.length > 0 && (
                  <button
                    className={`inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-bold ${
                      activeTab === "agent" ? "bg-[#2f6696] text-white" : "text-slate-600 hover:bg-slate-50"
                    }`}
                    onClick={() => setActiveTab("agent")}
                    type="button"
                  >
                    <Contact className="size-4" aria-hidden="true" />
                    Dari list agent
                  </button>
                )}
                <button
                  className={`inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-bold ${
                    activeTab === "single" ? "bg-[#2f6696] text-white" : "text-slate-600 hover:bg-slate-50"
                  }`}
                  onClick={() => setActiveTab("single")}
                  type="button"
                >
                  <UserPlus className="size-4" aria-hidden="true" />
                  Tambah satu user
                </button>
                <button
                  className={`inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-bold ${
                    activeTab === "bulk" ? "bg-[#2f6696] text-white" : "text-slate-600 hover:bg-slate-50"
                  }`}
                  onClick={() => setActiveTab("bulk")}
                  type="button"
                >
                  <Upload className="size-4" aria-hidden="true" />
                  Tambah banyak user
                </button>
              </div>
            </div>
          )}

          {activeTab === "agent" && agents.length > 0 ? (
            <form action={createUserFromAgent} className="grid gap-4 p-5" id={formId} key="agent">
              <div className="grid gap-4 md:grid-cols-2">
                <label className={labelClass}>
                  Agent aktif
                  <select
                    className={inputClass}
                    name="agent_id"
                    onChange={(event) => setSelectedAgentId(event.target.value)}
                    required
                    value={selectedAgentId}
                  >
                    <option value="">Pilih agent</option>
                    {agents.map((agent) => (
                      <option key={agent.agent_id} value={agent.agent_id}>
                        {agent.agent_name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={labelClass}>
                  Email
                  <input
                    className={`${inputClass} bg-slate-100`}
                    name="email"
                    disabled
                    required
                    type="email"
                    value={selectedAgent?.agent_email ?? ""}
                  />
                  <input name="email" type="hidden" value={selectedAgent?.agent_email ?? ""} />
                </label>
                <label className={labelClass}>
                  Posisi
                  <select className={inputClass} name="position_id">
                    <option value="">Pilih posisi</option>
                    {positions.map((position) => (
                      <option key={position.position_id} value={position.position_id}>
                        {position.position_name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={labelClass}>
                  Role
                  <select className={inputClass} defaultValue="viewer" name="role_id">
                    {roles.map((role) => (
                      <option key={role.role_id} value={role.role_id}>
                        {role.role_name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className={labelClass}>
                Branch Penempatan Agent
                <select
                  className={inputClass}
                  defaultValue={selectedAgent ? String(selectedAgent.branch_id) : ""}
                  key={selectedAgent?.agent_id ?? "no-agent"}
                  name="branch_ids"
                  required
                >
                  <option value="">Pilih branch</option>
                  {branches.map((branch) => (
                    <option key={branch.branch_id} value={branch.branch_id}>
                      {branch.branch_name}
                    </option>
                  ))}
                </select>
                <span className="font-normal text-slate-500">
                  Pilih satu branch. Jika berbeda dari branch asal agent, penempatan agent akan dipindahkan.
                </span>
              </label>
              <SalesAgentCheckbox
                defaultChecked
                formId={formId}
                initialBranchCount={selectedAgent ? 1 : 0}
                key={selectedAgent?.agent_id ?? "no-agent"}
              />
              <div className="flex justify-end">
                <SubmitButton className={buttonStyles.primary} pendingText="Menambah">
                  <Plus className="size-4" aria-hidden="true" />
                  Tambah
                </SubmitButton>
              </div>
            </form>
          ) : activeTab === "single" || !allowBulk ? (
            <form action={createSingleUser} className="grid gap-4 p-5" id={formId} key="single">
              <div className="grid gap-4 md:grid-cols-2">
                <label className={labelClass}>
                  Nama
                  <input className={inputClass} name="name" />
                </label>
                <label className={labelClass}>
                  Email
                  <input className={inputClass} name="email" required type="email" />
                </label>
                <label className={labelClass}>
                  Posisi
                  <select className={inputClass} name="position_id">
                    <option value="">Pilih posisi</option>
                    {positions.map((position) => (
                      <option key={position.position_id} value={position.position_id}>
                        {position.position_name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={labelClass}>
                  Role
                  <select className={inputClass} defaultValue="viewer" name="role_id">
                    {roles.map((role) => (
                      <option key={role.role_id} value={role.role_id}>
                        {role.role_name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className={labelClass}>
                <span>Akses Branch</span>
                <BranchAccessTable branches={branches} formId={formId} />
              </div>
              <SalesAgentCheckbox formId={formId} />
              <div className="flex justify-end">
                <SubmitButton className={buttonStyles.primary} pendingText="Menambah">
                  <Plus className="size-4" aria-hidden="true" />
                  Tambah
                </SubmitButton>
              </div>
            </form>
          ) : (
            <form action={bulkImportUsers} className="grid gap-4 p-5" key="bulk">
              <label className={labelClass}>
                Paste table
                <textarea
                  className="min-h-56 resize-y rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-700 outline-none focus:border-[#2f6696] focus:ring-2 focus:ring-[#2f6696]/20"
                  name="bulk_users"
                  placeholder={
                    "name\temail\tposition\trole\tbranches\tsales_agent\tpassword\nBudi\tbudi@email.com\tAdmin Officer\toperator\tMalang\tTRUE\t"
                  }
                />
              </label>
              <div className="flex justify-end">
                <SubmitButton className={buttonStyles.primary} pendingText="Import">
                  Import
                </SubmitButton>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
