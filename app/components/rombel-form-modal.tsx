"use client";

import { useRef, useState } from "react";
import { createRombel, updateRombel } from "@/app/auth/actions";
import { buttonGroups, buttonStyles } from "@/app/components/button-styles";
import { ModalCloseLink } from "@/app/components/modal-close-link";
import { SubmitButton } from "@/app/components/submit-button";

type AcademicYear = {
  academic_year: string;
};

type Grade = {
  grade_id: number;
  grade: string;
};
type RombelEditData = {
  rombel_id: number;
  academic_year: string | null;
  grade_id: number | null;
  rombel_name: string | null;
};

const mismatchMessage = "Nama rombel tidak sesuai dengan pilihan jenjang kelas";

function isRombelNameValidForGrade(gradeName: string | undefined, rombelName: string) {
  const expectedGradeNumber = gradeName?.match(/^\d+/)?.[0];
  const rombelPrefixNumber = rombelName.trim().match(/^\d+/)?.[0];

  if (!expectedGradeNumber || !rombelName.trim()) {
    return true;
  }

  if (expectedGradeNumber === "12") {
    return !rombelPrefixNumber || rombelPrefixNumber === "12";
  }

  return rombelPrefixNumber === expectedGradeNumber;
}

export function RombelFormModal({
  branchId,
  branchName,
  years,
  grades,
  closeHref,
  redirectTo,
  rombel,
  error,
}: {
  branchId: number;
  branchName: string;
  years: AcademicYear[];
  grades: Grade[];
  closeHref: string;
  redirectTo: string;
  rombel?: RombelEditData | null;
  error?: string;
}) {
  const isEditMode = Boolean(rombel?.rombel_id);
  const initialAcademicYear = rombel?.academic_year ?? "";
  const initialGradeId = rombel?.grade_id ? String(rombel.grade_id) : "";
  const initialRombelName = rombel?.rombel_name ?? "";
  const inactiveFieldClass = isEditMode ? "cursor-not-allowed bg-slate-100 text-slate-400" : "bg-white text-slate-700";
  const formRef = useRef<HTMLFormElement>(null);
  const [academicYear, setAcademicYear] = useState(initialAcademicYear);
  const [gradeId, setGradeId] = useState(initialGradeId);
  const [rombelName, setRombelName] = useState(initialRombelName);
  const selectedGrade = grades.find((grade) => String(grade.grade_id) === gradeId);
  const isRombelNameValid = isRombelNameValidForGrade(selectedGrade?.grade, rombelName);

  return (
    <div data-modal-root className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/55 p-3 sm:p-5">
      <section className="mx-auto max-w-2xl overflow-hidden rounded-lg bg-white text-slate-700 shadow-xl">
        <header className="flex items-center justify-between gap-4 border-b border-slate-200 p-4">
          <h2 className="text-xl font-bold text-slate-800">{isEditMode ? "Edit Rombel" : "Tambah Rombel"}</h2>
          <ModalCloseLink
            className={buttonStyles.secondary}
            href={closeHref}
          >
            Tutup
          </ModalCloseLink>
        </header>

        <form action={isEditMode ? updateRombel : createRombel} key={rombel?.rombel_id ?? "new"} ref={formRef}>
          <div className="grid gap-4 p-4">
            <input name="branch_id" type="hidden" value={branchId} />
            {isEditMode && <input name="rombel_id" type="hidden" value={rombel?.rombel_id} />}
            <input name="redirect_to" type="hidden" value={redirectTo} />

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-bold text-slate-500">
                Tahun Ajaran *
                <select
                  className={`h-10 rounded-md border border-slate-300 px-3 text-sm font-normal outline-none ${inactiveFieldClass}`}
                  name="academic_year"
                  value={academicYear}
                  onChange={(event) => setAcademicYear(event.target.value)}
                  disabled={isEditMode}
                  required
                >
                  <option disabled value="">
                    Pilih tahun ajaran
                  </option>
                  {years.map((year) => (
                    <option key={year.academic_year} value={year.academic_year}>
                      {year.academic_year}
                    </option>
                  ))}
                </select>
                {isEditMode && <input name="academic_year" type="hidden" value={academicYear} />}
              </label>

              <label className="grid gap-2 text-sm font-bold text-slate-500">
                Jenjang Kelas *
                <select
                  className={`h-10 rounded-md border border-slate-300 px-3 text-sm font-normal outline-none ${inactiveFieldClass}`}
                  name="grade_id"
                  value={gradeId}
                  onChange={(event) => setGradeId(event.target.value)}
                  disabled={isEditMode}
                  required
                >
                  <option disabled value="">
                    Pilih jenjang kelas
                  </option>
                  {grades
                    .filter((grade) => grade.grade.toLowerCase() !== "gapyear")
                    .map((grade) => (
                      <option key={grade.grade_id} value={grade.grade_id}>
                        {grade.grade}
                      </option>
                    ))}
                </select>
                {isEditMode && <input name="grade_id" type="hidden" value={gradeId} />}
              </label>
            </div>

            <label className="grid gap-2 text-sm font-bold text-slate-500">
              Nama Rombel CMS *
              <input
                className={`h-10 rounded-md border px-3 text-sm font-normal text-slate-700 outline-none ${
                  isRombelNameValid
                    ? "border-slate-300"
                    : "border-red-400 bg-red-50 focus:border-red-500 focus:ring-2 focus:ring-red-500/15"
                }`}
                name="rombel_name"
                value={rombelName}
                onChange={(event) => setRombelName(event.target.value)}
                placeholder="Contoh: 12 SMA R04.01"
                required
              />
              {!isRombelNameValid && <span className="text-xs font-bold text-red-600">{mismatchMessage}</span>}
            </label>

            <p className="text-sm font-semibold text-slate-500">Branch aktif: {branchName}</p>

            {error && (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                {error}
              </p>
            )}
          </div>

          <footer className={buttonGroups.modalFooter}>
            <button
              className={isEditMode ? buttonStyles.disabled : buttonStyles.secondary}
              type="button"
              disabled={isEditMode}
              onClick={() => {
                formRef.current?.reset();
                setAcademicYear(initialAcademicYear);
                setGradeId(initialGradeId);
                setRombelName(initialRombelName);
              }}
            >
              {isEditMode ? "Reset" : "Clear Form"}
            </button>
            <SubmitButton
              className={buttonStyles.primary}
              disabled={!isRombelNameValid}
              pendingText="Menyimpan"
            >
              {isEditMode ? "Perbarui" : "Simpan"}
            </SubmitButton>
          </footer>
        </form>
      </section>
    </div>
  );
}
