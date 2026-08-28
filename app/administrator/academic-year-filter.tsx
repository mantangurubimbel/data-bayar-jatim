"use client";

import { usePathname, useRouter } from "next/navigation";

export function AcademicYearFilter({
  academicYears,
  selectedAcademicYear,
}: {
  academicYears: { academic_year: string; is_active: boolean }[];
  selectedAcademicYear: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <label className="grid gap-1 text-xs font-bold text-slate-500">
      Tahun ajaran
      <select
        className="h-9 min-w-48 rounded-md border border-slate-200 bg-white px-3 text-sm font-normal text-slate-700 outline-none"
        name="academic_year"
        onChange={(event) => {
          const params = new URLSearchParams(window.location.search);
          params.set("academic_year", event.currentTarget.value);
          router.replace(`${pathname}?${params.toString()}`, { scroll: false });
        }}
        value={selectedAcademicYear}
      >
        {academicYears.map((academicYear) => (
          <option key={academicYear.academic_year} value={academicYear.academic_year}>
            {academicYear.academic_year}
            {academicYear.is_active ? " (Aktif)" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
