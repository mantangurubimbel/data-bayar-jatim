"use client";

import Link from "next/link";
import { RefreshCw, StickyNoteCheck, StickyNoteX, User, UserX } from "lucide-react";
import { useState, useTransition } from "react";
import { buttonStyles } from "@/app/components/button-styles";
import { StudentFilters } from "@/app/components/student-filters";

type StudentRow = {
  nis: string;
  user_name: string | null;
  school_name: string | null;
  grade: string | null;
  rombel_name: string | null;
  user_serial: string;
  is_incomplete: boolean | null;
  status: string | null;
};

const pageSize = 20;

export function StudentTableCard({
  branchId,
  branchName,
  academicYear,
  query,
  incompleteOnly,
  loyalOnly,
  statusFilter,
  keepParams,
  initialStudents,
  initialSerialCounts,
  initialCurrentPage,
  initialTotalPages,
  initialTotalStudents,
  detailBaseHref,
  addStudentHref,
  pageBaseHref,
}: {
  branchId: number | null;
  branchName: string;
  academicYear: string;
  query: string;
  incompleteOnly: boolean;
  loyalOnly: boolean;
  statusFilter: string;
  keepParams: Record<string, string | undefined>;
  initialStudents: StudentRow[];
  initialSerialCounts: Record<string, number>;
  initialCurrentPage: number;
  initialTotalPages: number;
  initialTotalStudents: number;
  detailBaseHref: string;
  addStudentHref: string;
  pageBaseHref: string;
}) {
  const [students, setStudents] = useState(initialStudents);
  const [serialCounts, setSerialCounts] = useState(initialSerialCounts);
  const [currentPage, setCurrentPage] = useState(initialCurrentPage);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [totalStudents, setTotalStudents] = useState(initialTotalStudents);
  const [error, setError] = useState<string | null>(null);
  const [filterKey, setFilterKey] = useState(0);
  const [filterIncompleteOnly, setFilterIncompleteOnly] = useState(incompleteOnly);
  const [filterLoyalOnly, setFilterLoyalOnly] = useState(loyalOnly);
  const [filterStatus, setFilterStatus] = useState(statusFilter);
  const [isPending, startTransition] = useTransition();
  const firstRow = totalStudents === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const lastRow = Math.min(currentPage * pageSize, totalStudents);

  function detailHref(nis: string) {
    const [pathname, queryString = ""] = detailBaseHref.split("?");
    const params = new URLSearchParams(queryString);
    params.set("student", nis);
    params.delete("history");
    return `${pathname}?${params.toString()}`;
  }

  function pageHref(page: number) {
    const [pathname, queryString = ""] = pageBaseHref.split("?");
    const params = new URLSearchParams(queryString);
    params.set("page", String(page));
    return `${pathname}?${params.toString()}`;
  }

  function refreshStudents() {
    if (!branchId || !academicYear) {
      return;
    }

    startTransition(async () => {
      setError(null);
      const nextPage = 1;
      const params = new URLSearchParams({
        branch: String(branchId),
        year: academicYear,
        page: String(nextPage),
      });

      if (query) {
        params.set("q", query);
      }
      if (incompleteOnly) {
        params.set("incomplete", "1");
      }
      if (statusFilter) {
        params.set("status", statusFilter);
      }
      if (loyalOnly) {
        params.set("loyal", "1");
      }

      const response = await fetch(`/api/students?${params.toString()}`, {
        cache: "no-store",
      });
      const result = (await response.json()) as {
        currentPage?: number;
        error?: string;
        serialCounts?: Record<string, number>;
        students?: StudentRow[];
        totalPages?: number;
        totalStudents?: number;
      };

      if (!response.ok) {
        setError(result.error ?? "Gagal memuat data siswa.");
        return;
      }

      const nextStudents = result.students ?? [];

      setStudents(nextStudents);
      setSerialCounts(result.serialCounts ?? {});
      setCurrentPage(result.currentPage ?? nextPage);
      setTotalPages(result.totalPages ?? 1);
      setTotalStudents(result.totalStudents ?? 0);
      window.history.replaceState(null, "", pageHref(nextPage));
      setFilterIncompleteOnly(false);
      setFilterLoyalOnly(false);
      setFilterStatus("");
      setFilterKey((current) => current + 1);
    });
  }

  return (
    <section className="flex h-[650px] flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Data Siswa {branchName}</h2>
          <p className="mt-2 text-sm font-semibold text-slate-500">
            {firstRow}-{lastRow} dari {totalStudents} hasil ditampilkan
          </p>
          {error ? <p className="mt-2 text-sm font-bold text-red-600">{error}</p> : null}
        </div>
        <div className="flex gap-2">
          <Link className={buttonStyles.primary} href={addStudentHref}>
            + Siswa
          </Link>
          <button
            aria-label="Muat ulang data siswa"
            className={buttonStyles.iconPrimary}
            disabled={isPending}
            onClick={refreshStudents}
            title="Muat ulang"
            type="button"
          >
            <RefreshCw className={isPending ? "animate-spin" : ""} size={18} strokeWidth={2.4} />
          </button>
        </div>
      </div>

      <StudentFilters
        key={filterKey}
        branchId={branchId}
        year={academicYear}
        query={query}
        incompleteOnly={filterIncompleteOnly}
        loyalOnly={filterLoyalOnly}
        statusFilter={filterStatus}
        keepParams={keepParams}
      />

      <div className="mt-5 h-[420px] shrink-0 overflow-y-auto overflow-x-hidden rounded-lg border border-slate-200">
        <table className="w-full table-fixed border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-100 text-slate-600">
            <tr>
              <th className="w-[28%] px-3 py-2 font-bold sm:w-[13%]">NIS</th>
              <th className="w-[44%] px-3 py-2 font-bold sm:w-[25%]">Nama Siswa</th>
              <th className="hidden w-[26%] px-3 py-2 font-bold sm:table-cell">Asal Sekolah</th>
              <th className="hidden w-[11%] px-3 py-2 font-bold sm:table-cell">Jenjang</th>
              <th className="w-[28%] px-3 py-2 font-bold sm:w-[15%]">Rombel</th>
              <th className="hidden w-[10%] px-3 py-2 text-center font-bold sm:table-cell">Info</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => (
              <tr key={student.nis} className="border-t border-slate-200">
                <td className="truncate px-3 py-2">
                  <Link className="font-medium text-[#2f6696] hover:underline" href={detailHref(student.nis)}>
                    {student.nis}
                  </Link>
                </td>
                <td
                  className={`truncate px-3 py-2 text-slate-600 ${
                    serialCounts[student.user_serial] > 1 ? "font-bold" : ""
                  }`}
                  title={student.user_name ?? ""}
                >
                  {student.user_name}
                </td>
                <td className="hidden truncate px-3 py-2 text-slate-600 sm:table-cell" title={student.school_name ?? ""}>
                  {student.school_name ?? "-"}
                </td>
                <td className="hidden truncate px-3 py-2 text-slate-600 sm:table-cell" title={student.grade ?? ""}>
                  {student.grade ?? "-"}
                </td>
                <td className="truncate px-3 py-2 text-slate-600" title={student.rombel_name ?? ""}>
                  {student.rombel_name ?? "-"}
                </td>
                <td className="hidden px-3 py-2 sm:table-cell">
                  <div className="flex items-center justify-center gap-2">
                    {student.is_incomplete ? (
                      <StickyNoteX
                        aria-label="Data belum lengkap"
                        className="size-4 text-orange-600"
                        strokeWidth={2.4}
                      />
                    ) : (
                      <StickyNoteCheck
                        aria-label="Data lengkap"
                        className="size-4 text-emerald-600"
                        strokeWidth={2.4}
                      />
                    )}
                    {student.status === "Inactive" ? (
                      <UserX
                        aria-label="Inactive"
                        className="size-4 text-orange-600"
                        strokeWidth={2.4}
                      />
                    ) : (
                      <User
                        aria-label="Active"
                        className="size-4 text-emerald-600"
                        strokeWidth={2.4}
                      />
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!students.length && (
              <tr>
                <td className="px-4 py-8 text-center font-semibold text-slate-500" colSpan={6}>
                  Data siswa belum tersedia untuk filter ini.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-auto flex shrink-0 flex-col gap-3 pt-4 text-sm font-bold text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <p>
          Menampilkan {firstRow}-{lastRow} dari {totalStudents} data
        </p>
        <div className="flex items-center gap-3">
          {currentPage > 1 ? (
            <Link
              className={buttonStyles.pager}
              href={pageHref(currentPage - 1)}
            >
              Prev
            </Link>
          ) : (
            <span className={buttonStyles.pagerDisabled}>
              Prev
            </span>
          )}
          <span>
            {currentPage} / {totalPages}
          </span>
          {currentPage < totalPages ? (
            <Link
              className={buttonStyles.pager}
              href={pageHref(currentPage + 1)}
            >
              Next
            </Link>
          ) : (
            <span className={buttonStyles.pagerDisabled}>
              Next
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
