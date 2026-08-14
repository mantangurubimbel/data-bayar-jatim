"use client";

import Link from "next/link";
import { Pencil, RefreshCw, Trash2 } from "lucide-react";
import { buttonStyles } from "@/app/components/button-styles";
import { useMemo, useState, useTransition } from "react";

type RombelRow = {
  rombel_id: number;
  grade: string | null;
  rombel_name: string | null;
  student_count: number | null;
};

const rombelPageSize = 20;

export function RombelTableCard({
  branchId,
  academicYear,
  initialRombels,
  initialCurrentPage,
  initialTotalPages,
  initialTotalRombels,
  actionHref,
  detailBaseHref,
  pageBaseHref,
}: {
  branchId: number | null;
  academicYear: string;
  initialRombels: RombelRow[];
  initialCurrentPage: number;
  initialTotalPages: number;
  initialTotalRombels: number;
  actionHref: string;
  detailBaseHref: string;
  pageBaseHref: string;
}) {
  const [rombels, setRombels] = useState(initialRombels);
  const [currentPage, setCurrentPage] = useState(initialCurrentPage);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [totalRombels, setTotalRombels] = useState(initialTotalRombels);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const firstRow = totalRombels === 0 ? 0 : (currentPage - 1) * rombelPageSize + 1;
  const lastRow = Math.min(currentPage * rombelPageSize, totalRombels);

  const rows = useMemo(
    () =>
      rombels.map((rombel) => [
        rombel.rombel_name ?? "-",
        rombel.grade ?? "-",
        String(rombel.student_count ?? 0),
        String(rombel.rombel_id),
      ]),
    [rombels],
  );

  function pageHref(page: number) {
    const [pathname, queryString = ""] = pageBaseHref.split("?");
    const params = new URLSearchParams(queryString);
    params.set("rombelPage", String(page));
    return `${pathname}?${params.toString()}`;
  }

  function refreshRombels() {
    if (!branchId || !academicYear) {
      return;
    }

    startTransition(async () => {
      setError(null);
      const params = new URLSearchParams({
        branch: String(branchId),
        year: academicYear,
        rombelPage: String(currentPage),
      });
      const response = await fetch(`/api/rombels?${params.toString()}`, {
        cache: "no-store",
      });
      const result = (await response.json()) as {
        currentPage?: number;
        error?: string;
        rombels?: RombelRow[];
        totalPages?: number;
        totalRombels?: number;
      };

      if (!response.ok) {
        setError(result.error ?? "Gagal memuat data rombel.");
        return;
      }

      setRombels(result.rombels ?? []);
      setCurrentPage(result.currentPage ?? currentPage);
      setTotalPages(result.totalPages ?? 1);
      setTotalRombels(result.totalRombels ?? 0);
    });
  }

  return (
    <section className="flex h-[650px] flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Data Rombel</h2>
          <p className="mt-2 text-sm font-semibold text-slate-500">
            {firstRow}-{lastRow} dari {totalRombels} hasil ditampilkan
          </p>
          {error ? <p className="mt-2 text-sm font-bold text-red-600">{error}</p> : null}
        </div>
        <div className="flex gap-2">
          <Link className={buttonStyles.primary} href={actionHref}>
            + Rombel
          </Link>
          <button
            aria-label="Muat ulang data rombel"
            className={buttonStyles.iconPrimary}
            disabled={isPending}
            onClick={refreshRombels}
            title="Muat ulang"
            type="button"
          >
            <RefreshCw className={isPending ? "animate-spin" : ""} size={17} strokeWidth={2.4} />
          </button>
        </div>
      </div>
      <RombelTable rows={rows} detailBaseHref={detailBaseHref} />
      <div className="mt-auto flex shrink-0 flex-col gap-3 pt-4 text-sm font-bold text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <p>
          Menampilkan {firstRow}-{lastRow} dari {totalRombels} data
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

function RombelTable({ rows, detailBaseHref }: { rows: string[][]; detailBaseHref: string }) {
  const columns = ["Nama Rombel", "Jenjang Kelas", "Jumsis", ""];
  const columnWidths = ["w-[40%]", "w-[25%]", "w-[18%]", "w-[17%]"];

  function detailHref(rombelId: string) {
    const [pathname, queryString = ""] = detailBaseHref.split("?");
    const params = new URLSearchParams(queryString);
    params.set("rombel", rombelId);
    params.delete("rombelStudents");
    params.delete("student");
    params.delete("history");
    return `${pathname}?${params.toString()}`;
  }
  function deleteHref(rombelId: string) {
    const [pathname, queryString = ""] = detailBaseHref.split("?");
    const params = new URLSearchParams(queryString);
    params.set("deleteRombel", rombelId);
    params.delete("rombel");
    params.delete("rombelStudents");
    params.delete("student");
    params.delete("history");
    return `${pathname}?${params.toString()}`;
  }
  function editHref(rombelId: string) {
    const [pathname, queryString = ""] = detailBaseHref.split("?");
    const params = new URLSearchParams(queryString);
    params.set("editRombel", rombelId);
    params.delete("deleteRombel");
    params.delete("rombel");
    params.delete("rombelStudents");
    params.delete("student");
    params.delete("history");
    return `${pathname}?${params.toString()}`;
  }

  return (
    <div className="mt-5 min-h-0 flex-1 overflow-y-auto overflow-x-hidden rounded-lg border border-slate-200">
      <table className="w-full table-fixed border-collapse text-left text-sm">
        <thead className="sticky top-0 z-10 bg-slate-100 text-slate-600">
          <tr>
            {columns.map((column, index) => (
              <th key={`${column}-${index}`} className={`px-3 py-2 font-bold ${columnWidths[index]}`}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.join("-")} className="border-t border-slate-200">
              {row.map((cell, index) => (
                <td
                  key={`${cell}-${index}`}
                  className={`truncate px-3 py-2 text-slate-600 ${
                    index === row.length - 1 ? "text-right" : ""
                  }`}
                  title={cell}
                >
                  {index === row.length - 1 ? (
                    <div className="inline-flex items-center justify-end gap-1">
                      <Link
                        aria-label={`Edit rombel ${row[0]}`}
                        className={buttonStyles.iconEdit}
                        href={editHref(row[3])}
                        title="Edit rombel"
                      >
                        <Pencil size={16} strokeWidth={2.2} />
                      </Link>
                      <Link
                        aria-label={`Hapus rombel ${row[0]}`}
                        className={Number(row[2]) > 0 ? buttonStyles.iconDisabled : buttonStyles.iconDanger}
                        href={Number(row[2]) > 0 ? "#" : deleteHref(row[3])}
                        title={
                          Number(row[2]) > 0
                            ? "Tidak bisa hapus rombel yang masih memiliki siswa"
                            : "Hapus rombel"
                        }
                      >
                        <Trash2 size={16} strokeWidth={2.2} />
                      </Link>
                    </div>
                  ) : index === 0 ? (
                    <Link className="font-medium text-[#2f6696] hover:underline" href={detailHref(row[3])}>
                      {cell}
                    </Link>
                  ) : (
                    cell
                  )}
                </td>
              ))}
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td className="px-4 py-8 text-center font-semibold text-slate-500" colSpan={4}>
                Data belum tersedia.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
