"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { buttonStyles } from "@/app/components/button-styles";

export function StudentFilters({
  branchId,
  year,
  query,
  incompleteOnly,
  keepParams = {},
}: {
  branchId: number | null;
  year: string;
  query: string;
  incompleteOnly: boolean;
  keepParams?: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const [search, setSearch] = useState(query);
  const [isIncomplete, setIsIncomplete] = useState(incompleteOnly);
  const isFirstRender = useRef(true);
  const keepParamsKey = JSON.stringify(keepParams);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (search === query && isIncomplete === incompleteOnly) {
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

      Object.entries(JSON.parse(keepParamsKey) as Record<string, string | undefined>).forEach(([key, value]) => {
        if (value) {
          params.set(key, value);
        }
      });

      params.set("page", "1");
      router.push(`/?${params.toString()}`);
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [branchId, incompleteOnly, isIncomplete, keepParamsKey, query, router, search, year]);

  return (
    <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_320px] lg:items-center">
      <label className="flex h-10 items-center gap-2 text-sm font-bold text-slate-600">
        <input
          type="checkbox"
          className="size-4 rounded border-slate-300"
          checked={isIncomplete}
          onChange={(event) => setIsIncomplete(event.target.checked)}
        />
        Data belum lengkap
      </label>
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
              ×
            </button>
          )}
        </span>
      </label>
    </div>
  );
}
