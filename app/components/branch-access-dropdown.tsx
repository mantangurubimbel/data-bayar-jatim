"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

type Branch = {
  branch_id: number;
  branch_name: string;
};

export function BranchAccessDropdown({
  branches,
  formId,
  selectedBranchIds,
}: {
  branches: Branch[];
  formId: string;
  selectedBranchIds: number[];
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [selected, setSelected] = useState(() => new Set(selectedBranchIds));

  const selectedBranches = useMemo(
    () => branches.filter((branch) => selected.has(branch.branch_id)),
    [branches, selected],
  );

  const selectedLabel = useMemo(() => {
    if (selected.size === 0) {
      return "Pilih cabang";
    }

    if (selected.size === 1) {
      return selectedBranches[0]?.branch_name ?? "1 cabang dipilih";
    }

    return `${selected.size} cabang dipilih`;
  }, [selected.size, selectedBranches]);

  useEffect(() => {
    function closeWhenOutside(event: MouseEvent) {
      const details = detailsRef.current;

      if (!details?.open || !(event.target instanceof Node)) {
        return;
      }

      if (!details.contains(event.target)) {
        details.open = false;
      }
    }

    document.addEventListener("mousedown", closeWhenOutside);
    return () => document.removeEventListener("mousedown", closeWhenOutside);
  }, []);

  function setAllBranches(checked: boolean) {
    setSelected(checked ? new Set(branches.map((branch) => branch.branch_id)) : new Set());
  }

  function toggleBranch(branchId: number, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);

      if (checked) {
        next.add(branchId);
      } else {
        next.delete(branchId);
      }

      return next;
    });
  }

  return (
    <details ref={detailsRef} className="group relative">
      <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none transition hover:border-slate-300 focus-visible:ring-2 focus-visible:ring-[#2f6696]/30 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 truncate">{selectedLabel}</span>
        <ChevronDown className="size-4 shrink-0 text-slate-400 transition group-open:rotate-180" aria-hidden="true" />
      </summary>

      {selectedBranches.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selectedBranches.slice(0, 3).map((branch) => (
            <span
              className="max-w-36 truncate rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600"
              key={branch.branch_id}
              title={branch.branch_name}
            >
              {branch.branch_name}
            </span>
          ))}
          {selectedBranches.length > 3 && (
            <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600">
              +{selectedBranches.length - 3}
            </span>
          )}
        </div>
      )}

      <div className="absolute left-0 top-11 z-30 w-full min-w-80 overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg">
        <div className="border-b border-slate-100 p-2">
          <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100">
            <input
              checked={branches.length > 0 && selected.size === branches.length}
              className="size-4 accent-[#2f6696]"
              onChange={(event) => setAllBranches(event.target.checked)}
              type="checkbox"
            />
            <span>Semua cabang</span>
          </label>
        </div>

        <div className="max-h-64 overflow-y-auto p-2">
          {branches.map((branch) => (
            <label
              className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              key={branch.branch_id}
            >
              <span className="flex min-w-0 items-center gap-2">
                <input
                  checked={selected.has(branch.branch_id)}
                  className="size-4 accent-[#2f6696]"
                  form={formId}
                  name="branch_ids"
                  onChange={(event) => toggleBranch(branch.branch_id, event.target.checked)}
                  type="checkbox"
                  value={branch.branch_id}
                />
                <span className="truncate" title={branch.branch_name}>
                  {branch.branch_name}
                </span>
              </span>
              {selected.has(branch.branch_id) && (
                <Check className="size-4 shrink-0 text-[#2f6696]" aria-hidden="true" />
              )}
            </label>
          ))}
        </div>
      </div>
    </details>
  );
}
