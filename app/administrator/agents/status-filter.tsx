"use client";

import { usePathname, useRouter } from "next/navigation";

export type AgentStatusFilterValue = "all" | "active" | "inactive";

export function AgentStatusFilter({ value }: { value: AgentStatusFilterValue }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <label className="grid gap-1 text-xs font-bold text-slate-500">
      Status
      <select
        className="h-9 min-w-40 rounded-md border border-slate-200 bg-white px-3 text-sm font-normal text-slate-700 outline-none"
        onChange={(event) => {
          const params = new URLSearchParams(window.location.search);
          params.set("status", event.currentTarget.value);
          params.delete("error");
          params.delete("success");
          router.replace(`${pathname}?${params.toString()}`, { scroll: false });
        }}
        value={value}
      >
        <option value="all">Semua status</option>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
      </select>
    </label>
  );
}
