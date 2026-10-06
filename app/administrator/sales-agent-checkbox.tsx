"use client";

import { useEffect, useState } from "react";

export function SalesAgentCheckbox({
  initialBranchCount,
  defaultChecked = false,
  formId,
}: {
  defaultChecked?: boolean;
  formId: string;
  initialBranchCount?: number;
}) {
  const [branchCount, setBranchCount] = useState(initialBranchCount ?? 0);
  const [checked, setChecked] = useState(defaultChecked);
  const isEnabled = branchCount === 1;

  useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) {
      return;
    }

    function syncBranchCount() {
      const selectedBranches = form?.querySelectorAll<HTMLInputElement>('input[name="branch_ids"]:checked') ?? [];
      const branchSelectors = form?.querySelectorAll<HTMLSelectElement>('select[name="branch_ids"]') ?? [];
      const selectedBranchCount =
        selectedBranches.length + [...branchSelectors].filter((select) => Boolean(select.value)).length;
      setBranchCount(selectedBranchCount);
      if (selectedBranchCount !== 1) {
        setChecked(false);
      }
    }

    syncBranchCount();
    form.addEventListener("change", syncBranchCount);
    return () => form.removeEventListener("change", syncBranchCount);
  }, [formId]);

  return (
    <label className="flex min-h-9 items-center gap-2 text-xs font-bold text-slate-500">
      <input
        checked={checked && isEnabled}
        className="size-4 rounded border-slate-300 text-[#2f6696]"
        disabled={!isEnabled}
        onChange={(event) => setChecked(event.target.checked)}
        name="sales_agent"
        type="checkbox"
        value="true"
      />
      Sales agent
    </label>
  );
}
