"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { buttonStyles } from "@/app/components/button-styles";
import { useState, useTransition } from "react";

type SchoolRow = {
  npsn: string;
  school_name: string | null;
  school_status: string | null;
};

const schoolPageSize = 20;

export function SchoolTableCard({
  branchId,
  initialSchools,
  initialCurrentPage,
  initialTotalPages,
  initialTotalSchools,
  actionHref,
  detailBaseHref,
  pageBaseHref,
}: {
  branchId: number | null;
  initialSchools: SchoolRow[];
  initialCurrentPage: number;
  initialTotalPages: number;
  initialTotalSchools: number;
  actionHref: string;
  detailBaseHref: string;
  pageBaseHref: string;
}) {
  const [schools, setSchools] = useState(initialSchools);
  const [currentPage, setCurrentPage] = useState(initialCurrentPage);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [totalSchools, setTotalSchools] = useState(initialTotalSchools);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const firstRow = totalSchools === 0 ? 0 : (currentPage - 1) * schoolPageSize + 1;
  const lastRow = Math.min(currentPage * schoolPageSize, totalSchools);

  function detailHref(npsn: string) {
    const [pathname, queryString = ""] = detailBaseHref.split("?");
    const params = new URLSearchParams(queryString);
    params.set("school", npsn);
    params.delete("student");
    params.delete("history");
    params.delete("rombel");
    params.delete("rombelStudents");
    return `${pathname}?${params.toString()}`;
  }

  function pageHref(page: number) {
    const [pathname, queryString = ""] = pageBaseHref.split("?");
    const params = new URLSearchParams(queryString);
    params.set("schoolPage", String(page));
    return `${pathname}?${params.toString()}`;
  }

  function refreshSchools() {
    if (!branchId) {
      return;
    }

    startTransition(async () => {
      setError(null);
      const params = new URLSearchParams({
        branch: String(branchId),
        schoolPage: String(currentPage),
      });
      const response = await fetch(`/api/schools?${params.toString()}`, {
        cache: "no-store",
      });
      const result = (await response.json()) as {
        currentPage?: number;
        error?: string;
        schools?: SchoolRow[];
        totalPages?: number;
        totalSchools?: number;
      };

      if (!response.ok) {
        setError(result.error ?? "Gagal memuat data sekolah.");
        return;
      }

      setSchools(result.schools ?? []);
      setCurrentPage(result.currentPage ?? currentPage);
      setTotalPages(result.totalPages ?? 1);
      setTotalSchools(result.totalSchools ?? 0);
    });
  }

  return (
    <section className="flex h-[650px] flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Data Sekolah Cabang</h2>
          <p className="mt-2 text-sm font-semibold text-slate-500">
            {firstRow}-{lastRow} dari {totalSchools} hasil ditampilkan
          </p>
          {error ? <p className="mt-2 text-sm font-bold text-red-600">{error}</p> : null}
        </div>
        <div className="flex gap-2">
          <Link className={buttonStyles.primary} href={actionHref} scroll={false}>
            + Sekolah
          </Link>
          <button
            aria-label="Muat ulang Data Sekolah Cabang"
            className={buttonStyles.iconPrimary}
            disabled={isPending}
            onClick={refreshSchools}
            title="Muat ulang"
            type="button"
          >
            <RefreshCw className={isPending ? "animate-spin" : ""} size={17} strokeWidth={2.4} />
          </button>
        </div>
      </div>

      <div className="mt-5 min-h-0 flex-1 overflow-y-auto overflow-x-hidden rounded-lg border border-slate-200">
        <table className="w-full table-fixed border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-100 text-slate-600">
            <tr>
              <th className="w-[22%] px-3 py-2 font-bold">NPSN</th>
              <th className="w-[58%] px-3 py-2 font-bold">Nama Sekolah</th>
              <th className="w-[20%] px-3 py-2 font-bold">Status</th>
            </tr>
          </thead>
          <tbody>
            {schools.map((school) => (
              <tr key={school.npsn} className="border-t border-slate-200">
                <td className="truncate px-3 py-2 text-slate-600" title={school.npsn}>
                  <Link className="font-medium text-[#2f6696] hover:underline" href={detailHref(school.npsn)}>
                    {school.npsn}
                  </Link>
                </td>
                <td className="truncate px-3 py-2 text-slate-600" title={school.school_name ?? ""}>
                  {school.school_name ?? "-"}
                </td>
                <td className="truncate px-3 py-2 text-slate-600" title={school.school_status ?? ""}>
                  {school.school_status ?? "-"}
                </td>
              </tr>
            ))}
            {!schools.length && (
              <tr>
                <td className="px-4 py-8 text-center font-semibold text-slate-500" colSpan={3}>
                  Data belum tersedia.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-auto flex shrink-0 flex-col gap-3 pt-4 text-sm font-bold text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <p>
          Menampilkan {firstRow}-{lastRow} dari {totalSchools} data
        </p>
        <div className="flex items-center gap-3">
          {currentPage > 1 ? (
              <Link
                className={buttonStyles.pager}
                href={pageHref(currentPage - 1)}
                scroll={false}
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
                scroll={false}
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
