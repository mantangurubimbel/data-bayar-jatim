"use client";

import { Check } from "lucide-react";
import { type BranchRow } from "@/app/administrator/admin-utils";

export function BranchAccessTable({
  branches,
  formId,
  selectedBranchIds = [],
}: {
  branches: BranchRow[];
  formId: string;
  selectedBranchIds?: number[];
}) {
  const branchesByRegion = new Map<string, BranchRow[]>();

  branches.forEach((branch) => {
    const region = Array.isArray(branch.t_region) ? branch.t_region[0] : branch.t_region;
    const regionName = region?.region_name ?? `Regional ${branch.region_id ?? "-"}`;
    const regionBranches = branchesByRegion.get(regionName) ?? [];
    regionBranches.push(branch);
    branchesByRegion.set(regionName, regionBranches);
  });

  return (
    <div className="max-h-72 overflow-auto rounded-md border border-slate-200 bg-white">
      <table className="w-full min-w-[720px] text-left text-sm font-normal text-slate-700">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            {[...branchesByRegion.keys()].map((regionName) => (
              <th className="border-r border-slate-200 px-4 py-3 font-normal last:border-r-0" key={regionName}>
                {regionName}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="align-top">
            {[...branchesByRegion.entries()].map(([regionName, regionBranches]) => (
              <td className="border-r border-slate-200 p-2 last:border-r-0" key={regionName}>
                <div className="grid gap-1">
                  {regionBranches.map((branch) => (
                    <label
                      className="flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-2 text-sm font-normal text-slate-700 hover:bg-slate-50"
                      key={branch.branch_id}
                    >
                      <input
                        defaultChecked={selectedBranchIds.includes(branch.branch_id)}
                        className="peer sr-only"
                        form={formId}
                        name="branch_ids"
                        type="checkbox"
                        value={branch.branch_id}
                      />
                      <span className="flex size-4 shrink-0 items-center justify-center rounded border border-slate-300 bg-white text-white peer-checked:border-[#2f6696] peer-checked:bg-[#2f6696]">
                        <Check className="size-3" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 truncate" title={branch.branch_name}>
                        {branch.branch_name}
                      </span>
                    </label>
                  ))}
                </div>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
