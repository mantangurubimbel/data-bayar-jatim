"use client";

import { ChevronDown } from "lucide-react";
import { useMemo, useRef, useState } from "react";

export function AcademicYearMultiSelect({
  academicYears,
  selectedAcademicYears,
}: {
  academicYears: { academic_year: string }[];
  selectedAcademicYears: string[];
}) {
  const [selected, setSelected] = useState(() => new Set(selectedAcademicYears));
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const selectedLabel = useMemo(
    () =>
      [...selected].length > 0
        ? [...selected].join(", ")
        : "Pilih tahun ajaran",
    [selected],
  );

  return (
    <details ref={detailsRef} className="group relative z-30">
      <summary className="flex h-9 cursor-pointer list-none items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 text-sm font-normal text-slate-700 [&::-webkit-details-marker]:hidden">
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown className="size-4 shrink-0 text-slate-400 transition group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="absolute left-0 top-11 z-50 w-full min-w-56 overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg">
        <div className="max-h-56 overflow-y-auto p-2">
          {academicYears.map((academicYear) => (
            <label
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm font-normal text-slate-700 hover:bg-slate-50"
              key={academicYear.academic_year}
            >
              <input
                checked={selected.has(academicYear.academic_year)}
                className="size-4 accent-[#2f6696]"
                name="academic_years"
                onChange={(event) => {
                  setSelected((current) => {
                    const next = new Set(current);
                    if (event.target.checked) next.add(academicYear.academic_year);
                    else next.delete(academicYear.academic_year);
                    return next;
                  });
                }}
                type="checkbox"
                value={academicYear.academic_year}
              />
              {academicYear.academic_year}
            </label>
          ))}
        </div>
      </div>
    </details>
  );
}
