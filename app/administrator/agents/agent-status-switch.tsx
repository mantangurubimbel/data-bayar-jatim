"use client";

import { useTransition } from "react";
import { updateAgentStatus } from "@/app/auth/actions";
import { type AgentStatusFilterValue } from "@/app/administrator/agents/status-filter";

export function AgentStatusSwitch({
  agentId,
  isActive,
  status,
}: {
  agentId: number;
  isActive: boolean;
  status: AgentStatusFilterValue;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <form>
      <input name="agent_id" type="hidden" value={agentId} />
      <input name="status" type="hidden" value={status} />
      <label className="inline-flex cursor-pointer items-center">
        <input
          aria-label="Ubah status agent"
          className="peer sr-only"
          defaultChecked={isActive}
          disabled={isPending}
          name="is_active"
          onChange={(event) => {
            const form = event.currentTarget.form;
            if (!form) {
              return;
            }
            startTransition(() => {
              updateAgentStatus(new FormData(form));
            });
          }}
          type="checkbox"
        />
        <span className="h-6 w-11 rounded-full bg-slate-200 p-0.5 transition-colors peer-checked:bg-emerald-500 peer-disabled:opacity-50">
          <span className={`block size-5 rounded-full bg-white shadow-sm transition-transform ${isActive ? "translate-x-5" : ""}`} />
        </span>
      </label>
    </form>
  );
}
