"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { createStudent, updateStudent } from "@/app/auth/actions";
import { buttonGroups, buttonStyles } from "@/app/components/button-styles";
import { ModalCloseLink } from "@/app/components/modal-close-link";
import { SubmitButton } from "@/app/components/submit-button";

type AcademicYear = {
  academic_year: string;
};

type Grade = {
  grade_id: number;
  grade: string;
  level: string | null;
};

type School = {
  npsn: string;
  name: string | null;
  level: string | null;
  student_count: number | null;
};

type PaymentMethod = {
  payment_id?: number;
  payment_method: string;
};

type Agent = {
  agent_id?: number;
  agent_name: string;
  branch_id: number | null;
  t_branch?: { region_id: number | null } | { region_id: number | null }[] | null;
};

type Rombel = {
  rombel_id: number;
  rombel_name: string | null;
  grade: string | null;
  academic_year: string | null;
};

type StudentEditData = {
  nis: string | null;
  payment_date: string | null;
  academic_year: string | null;
  user_serial: string | null;
  user_name: string | null;
  user_phone: string | null;
  birth_date: string | null;
  email: string | null;
  grade_id: number | null;
  npsn: string | null;
  rombel_id: number | null;
  parents_name: string | null;
  parents_phone: string | null;
  agent_id: number | null;
  payment_id: number | null;
  status: string | null;
};

const inputClass =
  "h-10 w-full min-w-0 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-[#2f6696] focus:ring-2 focus:ring-[#2f6696]/15";
const mutedInputClass =
  "h-10 w-full min-w-0 rounded-md border border-slate-200 bg-slate-100 px-3 text-sm font-bold text-slate-500 outline-none";
const labelClass = "grid min-w-0 gap-1.5 text-xs font-bold text-slate-500";
const selectClass = `${inputClass} appearance-auto`;
const emptyFieldClass = "!border-red-400 !bg-red-50 focus:!border-red-500 focus:!ring-red-500/15";
const todayDateInputValue = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

export function StudentFormModal({
  branchId,
  branchName,
  closeHref,
  redirectTo,
  years,
  grades,
  schools,
  paymentMethods,
  agents,
  rombels,
  student,
  error,
}: {
  branchId?: number;
  branchName: string;
  closeHref: string;
  redirectTo?: string;
  years: AcademicYear[];
  grades: Grade[];
  schools: School[];
  paymentMethods: PaymentMethod[];
  agents: Agent[];
  rombels: Rombel[];
  student?: StudentEditData | null;
  error?: string;
}) {
  const isEditMode = Boolean(student?.nis);
  const [formResetKey, setFormResetKey] = useState(0);
  const [selectedAcademicYear, setSelectedAcademicYear] = useState(student?.academic_year ?? "");
  const [selectedGradeId, setSelectedGradeId] = useState(student?.grade_id ? String(student.grade_id) : "");
  const selectedSchoolNpsn = student?.npsn ?? "";
  const selectedRombelId = student?.rombel_id ? String(student.rombel_id) : "";
  const selectedGrade = grades.find((grade) => String(grade.grade_id) === selectedGradeId);
  const selectedRombelGrade = selectedGrade?.grade.toLowerCase() === "gapyear" ? "12 SMA" : selectedGrade?.grade;
  const fieldClass = (value: string | number | null | undefined, baseClass = inputClass) =>
    isEditMode && !String(value ?? "").trim() ? `${baseClass} ${emptyFieldClass}` : baseClass;
  const filteredSchools = useMemo(
    () => schools.filter((school) => school.level && school.level === selectedGrade?.level),
    [schools, selectedGrade?.level],
  );
  const filteredRombels = useMemo(
    () =>
      rombels.filter(
        (rombel) =>
          rombel.academic_year === selectedAcademicYear && rombel.grade && rombel.grade === selectedRombelGrade,
      ),
    [rombels, selectedAcademicYear, selectedRombelGrade],
  );

  return (
    <div data-modal-root className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/55 p-2 sm:p-4">
      <section className="mx-auto max-w-5xl overflow-hidden rounded-lg bg-white text-slate-700 shadow-xl">
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <h2 className="text-xl font-bold text-slate-800">
            {isEditMode ? `Edit Siswa: ${student?.nis}` : `Tambah Siswa: ${branchName}`}
          </h2>
          <ModalCloseLink aria-label="Tutup modal" className={buttonStyles.iconClose} href={closeHref} title="Tutup">
            <X className="size-4" aria-hidden="true" />
          </ModalCloseLink>
        </header>

        <form action={isEditMode ? updateStudent : createStudent} key={formResetKey}>
          <div className="grid gap-4 p-4">
            <input name="redirect_to" type="hidden" value={redirectTo ?? closeHref} />
            {!isEditMode && branchId && <input name="branch_id" type="hidden" value={branchId} />}
            <p className="text-sm font-bold text-slate-500">
              {isEditMode ? "Perbarui data siswa sesuai kebutuhan." : "Siap input data siswa."}
            </p>
            {error && (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                {error}
              </p>
            )}

            <div className="grid gap-4 lg:grid-cols-3">
              <label className={labelClass}>
                NIS
                <input className={mutedInputClass} name="nis" readOnly value={student?.nis ?? ""} />
              </label>
              <label className={labelClass}>
                Tahun Ajaran *
                <select
                  className={fieldClass(
                    selectedAcademicYear,
                    isEditMode ? mutedInputClass : selectClass,
                  )}
                  name="academic_year"
                  onChange={(event) => setSelectedAcademicYear(event.target.value)}
                  disabled={isEditMode}
                  required={!isEditMode}
                  value={selectedAcademicYear}
                >
                  <option value="" disabled>
                    Pilih tahun ajaran
                  </option>
                  {years.map((year) => (
                    <option key={year.academic_year} value={year.academic_year}>
                      {year.academic_year}
                    </option>
                  ))}
                </select>
              </label>
              <label className={labelClass}>
                Tanggal Bayar *
                <input
                  className={fieldClass(student?.payment_date)}
                  defaultValue={student?.payment_date ?? ""}
                  max={todayDateInputValue}
                  name="payment_date"
                  required
                  type="date"
                />
              </label>
            </div>

            {!isEditMode && (
              <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
                <input
                  className="size-4 accent-[#2f6696]"
                  name="create_next_academic_year"
                  type="checkbox"
                  value="1"
                />
                Daftarkan juga ke tahun ajaran berikutnya
              </label>
            )}

            <div className="grid gap-4 lg:grid-cols-2">
              <label className={labelClass}>
                Nama Siswa *
                <input className={fieldClass(student?.user_name)} defaultValue={student?.user_name ?? ""} name="user_name" required />
              </label>
              <label className={labelClass}>
                User Serial *
                <input className={fieldClass(student?.user_serial)} defaultValue={student?.user_serial ?? ""} name="user_serial" required />
              </label>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <label className={labelClass}>
                No HP/WA *
                <input
                  className={fieldClass(student?.user_phone)}
                  defaultValue={student?.user_phone ?? ""}
                  inputMode="numeric"
                  maxLength={15}
                  minLength={8}
                  name="user_phone"
                  pattern="[0-9]{8,15}"
                  required
                />
              </label>
              <label className={labelClass}>
                Tanggal Lahir
                <input className={fieldClass(student?.birth_date)} defaultValue={student?.birth_date ?? ""} name="birth_date" type="date" />
              </label>
              <label className={labelClass}>
                Email *
                <input
                  className={fieldClass(student?.email)}
                  defaultValue={student?.email ?? ""}
                  name="email"
                  required
                  title="Domain email sepertinya salah. Periksa kembali alamat email."
                  type="email"
                />
              </label>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)]">
              <label className={labelClass}>
                Jenjang Kelas *
                <select
                  className={fieldClass(selectedGradeId, selectClass)}
                  name="grade_id"
                  onChange={(event) => setSelectedGradeId(event.target.value)}
                  required
                  value={selectedGradeId}
                >
                  <option value="" disabled>
                    Pilih jenjang kelas
                  </option>
                  {grades.map((grade) => (
                    <option key={grade.grade_id} value={grade.grade_id}>
                      {grade.grade}
                    </option>
                  ))}
                </select>
              </label>
              <label className={labelClass}>
                Asal Sekolah *
                <select
                  className={fieldClass(selectedSchoolNpsn, selectClass)}
                  defaultValue={selectedSchoolNpsn}
                  disabled={!selectedGrade}
                  key={`school-${selectedGradeId}-${selectedSchoolNpsn}`}
                  name="school_npsn"
                  required
                >
                  <option value="" disabled>
                    {selectedGrade ? "Pilih asal sekolah" : "Pilih jenjang kelas dahulu"}
                  </option>
                  {filteredSchools.map((school) => (
                    <option key={school.npsn} value={school.npsn}>
                      {school.name ?? school.npsn}
                    </option>
                  ))}
                </select>
              </label>
              <label className={labelClass}>
                Nama Rombel
                <select
                  className={fieldClass(selectedRombelId, selectClass)}
                  defaultValue={selectedRombelId}
                  disabled={!selectedAcademicYear || !selectedGrade}
                  key={`rombel-${selectedAcademicYear}-${selectedGradeId}-${selectedRombelId}`}
                  name="rombel_id"
                >
                  <option value="" disabled>
                    {selectedAcademicYear && selectedGrade ? "Pilih nama rombel" : "Pilih tahun dan kelas dahulu"}
                  </option>
                  {filteredRombels.map((rombel) => (
                    <option key={rombel.rombel_id} value={rombel.rombel_id}>
                      {rombel.rombel_name ?? rombel.rombel_id}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <label className={labelClass}>
                Nama Orang Tua
                <input className={fieldClass(student?.parents_name)} defaultValue={student?.parents_name ?? ""} name="parents_name" />
              </label>
              <label className={labelClass}>
                No HP/WA Orang Tua
                <input
                  className={fieldClass(student?.parents_phone)}
                  defaultValue={student?.parents_phone ?? ""}
                  inputMode="numeric"
                  maxLength={15}
                  minLength={8}
                  name="parents_phone"
                  pattern="[0-9]{8,15}"
                />
              </label>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <label className={labelClass}>
                Metode Pembayaran *
                <select
                  className={fieldClass(student?.payment_id, selectClass)}
                  defaultValue={student?.payment_id ? String(student.payment_id) : ""}
                  name="payment_id"
                  required
                >
                  <option value="" disabled>
                    Pilih metode pembayaran
                  </option>
                  {paymentMethods.map((method) => (
                    <option
                      key={method.payment_id ?? method.payment_method}
                      value={method.payment_id ?? method.payment_method}
                    >
                      {method.payment_method}
                    </option>
                  ))}
                </select>
              </label>
              <label className={labelClass}>
                Nama Agent *
                <select
                  className={fieldClass(student?.agent_id, selectClass)}
                  defaultValue={student?.agent_id ? String(student.agent_id) : ""}
                  name="agent_id"
                  required
                >
                  <option value="" disabled>
                    Pilih nama agent
                  </option>
                  {agents.map((agent) => (
                    <option
                      key={`${agent.branch_id}-${agent.agent_id ?? agent.agent_name}`}
                      value={agent.agent_id ?? agent.agent_name}
                    >
                      {agent.agent_name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={labelClass}>
                Status
                {!isEditMode && <input name="status" type="hidden" value="Active" />}
                <select
                  className={isEditMode ? selectClass : mutedInputClass}
                  defaultValue={student?.status ?? "Active"}
                  disabled={!isEditMode}
                  name="status"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </label>
            </div>
          </div>

          <footer className={buttonGroups.footer}>
            <button
              className={isEditMode ? buttonStyles.disabledSmall : buttonStyles.secondarySmall}
              disabled={isEditMode}
              onClick={() => {
                setSelectedAcademicYear(student?.academic_year ?? "");
                setSelectedGradeId(student?.grade_id ? String(student.grade_id) : "");
                setFormResetKey((currentKey) => currentKey + 1);
              }}
              type="button"
            >
              Clear Form
            </button>
            <SubmitButton
              className={buttonStyles.primarySmall}
              pendingText="Menyimpan"
            >
              Simpan
            </SubmitButton>
          </footer>
        </form>
      </section>
    </div>
  );
}
