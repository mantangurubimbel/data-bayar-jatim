import { Plus, X } from "lucide-react";
import { createAgent } from "@/app/auth/actions";
import { type BranchRow } from "@/app/administrator/admin-utils";
import { buttonStyles } from "@/app/components/button-styles";
import { ModalCloseLink } from "@/app/components/modal-close-link";
import { SubmitButton } from "@/app/components/submit-button";

const inputClass =
  "h-9 min-w-0 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-[#2f6696] focus:ring-2 focus:ring-[#2f6696]/20";
const labelClass = "grid gap-1 text-xs font-bold text-slate-500";

export function AddAgentModal({
  branches,
  closeHref,
  status,
}: {
  branches: BranchRow[];
  closeHref: string;
  status: string;
}) {
  return (
    <div data-modal-root className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/55 p-3 sm:p-5">
      <div className="mx-auto grid min-h-full max-w-xl place-items-center">
        <div className="w-full overflow-hidden rounded-md border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Tambah Agent</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                Agent baru akan langsung berstatus aktif.
              </p>
            </div>
            <ModalCloseLink aria-label="Tutup modal" className={buttonStyles.iconClose} href={closeHref} title="Tutup">
              <X className="size-4" aria-hidden="true" />
            </ModalCloseLink>
          </div>

          <form action={createAgent} className="grid gap-4 p-5">
            <input name="status" type="hidden" value={status} />
            <label className={labelClass}>
              Nama Agent
              <input autoFocus className={inputClass} name="agent_name" required />
            </label>
            <label className={labelClass}>
              Email
              <input className={inputClass} name="agent_email" required type="email" />
            </label>
            <label className={labelClass}>
              Branch
              <select className={inputClass} defaultValue="" name="branch_id" required>
                <option disabled value="">
                  Pilih branch
                </option>
                {branches
                  .filter((branch) => branch.branch_id !== 100)
                  .map((branch) => (
                    <option key={branch.branch_id} value={branch.branch_id}>
                      {branch.branch_name}
                    </option>
                  ))}
              </select>
            </label>
            <div className="flex justify-end">
              <SubmitButton className={buttonStyles.primary} pendingText="Menambah">
                <Plus className="size-4" aria-hidden="true" />
                Tambah Agent
              </SubmitButton>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
