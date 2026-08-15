"use client";

import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { buttonStyles } from "@/app/components/button-styles";

function filterButtonStyle(isActive: boolean) {
  return isActive ? buttonStyles.primary : buttonStyles.secondary;
}

export function StudentFilters({
  branchId,
  year,
  query,
  incompleteOnly,
  loyalOnly,
  statusFilter,
  keepParams = {},
}: {
  branchId: number | null;
  year: string;
  query: string;
  incompleteOnly: boolean;
  loyalOnly: boolean;
  statusFilter: string;
  keepParams?: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const [search, setSearch] = useState(query);
  const [isIncomplete, setIsIncomplete] = useState(incompleteOnly);
  const [isLoyal, setIsLoyal] = useState(loyalOnly);
  const [selectedStatus, setSelectedStatus] = useState(statusFilter);
  const isFirstRender = useRef(true);
  const keepParamsKey = JSON.stringify(keepParams);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (
      search === query &&
      isIncomplete === incompleteOnly &&
      isLoyal === loyalOnly &&
      selectedStatus === statusFilter
    ) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const params = new URLSearchParams();

      if (branchId) {
        params.set("branch", String(branchId));
      }

      params.set("year", year);

      if (search.trim()) {
        params.set("q", search.trim());
      }
      if (isIncomplete) {
        params.set("incomplete", "1");
      }
      if (isLoyal) {
        params.set("loyal", "1");
      }
      if (selectedStatus) {
        params.set("status", selectedStatus);
      }

      Object.entries(JSON.parse(keepParamsKey) as Record<string, string | undefined>).forEach(([key, value]) => {
        if (value) {
          params.set(key, value);
        }
      });

      params.set("page", "1");
      router.push(`/?${params.toString()}`);
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [
    branchId,
    incompleteOnly,
    isIncomplete,
    isLoyal,
    keepParamsKey,
    loyalOnly,
    query,
    router,
    search,
    selectedStatus,
    statusFilter,
    year,
  ]);

  return (
    <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
      <div className="flex flex-wrap items-center gap-2">
        <span className="relative inline-flex">
          <select
            aria-label="Filter status siswa"
            className={`${buttonStyles.secondary} appearance-none pr-9 outline-none`}
            value={selectedStatus}
            onChange={(event) => setSelectedStatus(event.target.value)}
          >
            <option value="">Semua Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
          <ChevronDown
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-500"
            strokeWidth={2.4}
          />
        </span>
        <button
          className={filterButtonStyle(isIncomplete)}
          onClick={() => setIsIncomplete((current) => !current)}
          type="button"
        >
          Belum Lengkap
        </button>
        <button
          className={filterButtonStyle(isLoyal)}
          onClick={() => setIsLoyal((current) => !current)}
          type="button"
        >
          Siswa Loyal
        </button>
      </div>
      <label className="grid text-sm font-bold text-slate-500">
        <span className="sr-only">Cari</span>
        <span className="group relative block">
          <input
            className="h-10 w-full rounded-md border border-slate-300 px-3 pr-9 text-sm font-normal outline-none"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari data siswa"
          />
          {search && (
            <button
              className={buttonStyles.clearSearch}
              type="button"
              onClick={() => setSearch("")}
              aria-label="Hapus pencarian"
            >
              x
            </button>
          )}
        </span>
      </label>
    </div>
  );
}
