import { MoveRight, X } from "lucide-react";
import { moveAgentBranch } from "@/app/auth/actions";
import { type AgentRow, type BranchRow } from "@/app/administrator/admin-utils";
import { buttonStyles } from "@/app/components/button-styles";
import { ModalCloseLink } from "@/app/components/modal-close-link";
import { SubmitButton } from "@/app/components/submit-button";

const inputClass =
  "h-9 min-w-0 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-[#2f6696] focus:ring-2 focus:ring-[#2f6696]/20";
const labelClass = "grid gap-1 text-xs font-bold text-slate-500";

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function MoveAgentModal({
  agent,
  branches,
  closeHref,
  status,
}: {
  agent: AgentRow;
  branches: BranchRow[];
  closeHref: string;
  status: string;
}) {
  const currentBranch = firstRelation(agent.t_branch);
  const destinationBranches = branches.filter((branch) => branch.branch_id !== 100);

  return (
    <div data-modal-root className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/55 p-3 sm:p-5">
      <div className="mx-auto grid min-h-full max-w-xl place-items-center">
        <div className="w-full overflow-hidden rounded-md border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Pindah Branch Agent</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">{agent.agent_name}</p>
            </div>
            <ModalCloseLink aria-label="Tutup modal" className={buttonStyles.iconClose} href={closeHref} title="Tutup">
              <X className="size-4" aria-hidden="true" />
            </ModalCloseLink>
          </div>

          <form action={moveAgentBranch} className="grid gap-4 p-5">
            <input name="agent_id" type="hidden" value={agent.agent_id} />
            <input name="status" type="hidden" value={status} />
            <div className="grid gap-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <span className="text-xs font-bold text-slate-500">Branch saat ini</span>
              <span className="font-semibold text-slate-700">{currentBranch?.branch_name ?? "Belum ditentukan"}</span>
            </div>
            <label className={labelClass}>
              Branch tujuan
              <select className={inputClass} defaultValue="" name="branch_id" required>
                <option disabled value="">
                  Pilih branch tujuan
                </option>
                {destinationBranches.map((branch) => (
                  <option key={branch.branch_id} value={branch.branch_id}>
                    {branch.branch_name}
                  </option>
                ))}
              </select>
            </label>
            {agent.app_user_id ? (
              <p className="text-xs font-semibold text-amber-700">
                Agent terhubung ke user. Akses branch user akan disesuaikan ke branch tujuan.
              </p>
            ) : null}
            <div className="flex justify-end">
              <SubmitButton className={buttonStyles.primary} pendingText="Memindahkan">
                <MoveRight className="size-4" aria-hidden="true" />
                Pindah Branch
              </SubmitButton>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
