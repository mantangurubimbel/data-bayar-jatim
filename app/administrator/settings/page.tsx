import { updateAcademicYearInputOptions, updateMaintenanceMode, updateAcademicYearStatus } from "@/app/auth/actions";
import { isFullAdminRole, requireAdminContext } from "@/app/administrator/admin-utils";
import { PageHeader } from "@/app/administrator/page-header";
import { AcademicYearMultiSelect } from "@/app/administrator/academic-year-multi-select";
import { buttonStyles } from "@/app/components/button-styles";
import { SubmitButton } from "@/app/components/submit-button";

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const params = await searchParams;
  const { dataSupabase, profile } = await requireAdminContext();
  if (!isFullAdminRole(profile.role_id)) {
    return (
      <>
        <PageHeader description="Atur mode perbaikan dan akses sementara website." title="Pengaturan" />
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          Akses admin penuh dibutuhkan.
        </div>
      </>
    );
  }
  const [{ data }, { data: academicYears }, { data: inputSetting }] = await Promise.all([
    dataSupabase
      .from("t_app_setting")
      .select("setting_value")
      .eq("setting_key", "maintenance")
      .maybeSingle(),
    dataSupabase
      .from("t_academic_year")
      .select("academic_year, is_active")
      .order("academic_year", { ascending: false }),
    dataSupabase
      .from("t_app_setting")
      .select("setting_value")
      .eq("setting_key", "student_input_academic_years")
      .maybeSingle(),
  ]);
  const value = (data?.setting_value ?? {}) as { enabled?: boolean; message?: string };
  const isEnabled = Boolean(value.enabled);
  const message = value.message || "Dalam perbaikan";
  const inputSettingValue = (inputSetting?.setting_value ?? {}) as { academic_years?: string[] };
  const inputAcademicYears = new Set(inputSettingValue.academic_years ?? (academicYears ?? []).map((year) => year.academic_year));

  return (
    <>
      <PageHeader description="Atur mode perbaikan dan akses sementara website." title="Pengaturan" />
      {params.error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {params.error}
        </div>
      )}
      {params.success === "1" && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          Pengaturan berhasil disimpan.
        </div>
      )}
      {(params.success === "academic-year" || params.success === "academic-year-input") && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          Tahun ajaran aktif berhasil diperbarui.
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <section className="relative z-10 overflow-visible rounded-md border border-slate-200 bg-white">
          <div className="border-b border-slate-200 p-4">
            <h2 className="text-xl font-bold">Default Tahun Ajaran Aktif</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Menentukan tahun ajaran default yang digunakan dashboard.
            </p>
          </div>
          <form action={updateAcademicYearStatus} className="flex items-end gap-2 p-4">
            <select
              className="h-9 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-3 text-sm font-normal text-slate-700"
              name="academic_year"
              defaultValue={academicYears?.find((year) => year.is_active)?.academic_year ?? ""}
            >
              {(academicYears ?? []).map((year) => (
                <option key={year.academic_year} value={year.academic_year}>
                  {year.academic_year}
                </option>
              ))}
            </select>
            <input name="is_active" type="hidden" value="true" />
            <SubmitButton className={`${buttonStyles.secondarySmall} h-9`} pendingText="Menyimpan">
              Simpan pilihan
            </SubmitButton>
          </form>
        </section>

        <section className="relative z-20 overflow-visible rounded-md border border-slate-200 bg-white">
          <div className="border-b border-slate-200 p-4">
            <h2 className="text-xl font-bold">Pilihan Tahun Ajaran untuk Input Siswa</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Pilih satu atau beberapa tahun ajaran yang muncul pada form + Siswa.
            </p>
          </div>
          <form action={updateAcademicYearInputOptions} className="flex items-end gap-2 p-4">
            <div className="min-w-0 flex-1">
              <AcademicYearMultiSelect
                academicYears={academicYears ?? []}
                selectedAcademicYears={[...inputAcademicYears]}
              />
            </div>
            <SubmitButton className={`${buttonStyles.secondarySmall} h-9 shrink-0`} pendingText="Menyimpan">
              Simpan Pilihan
            </SubmitButton>
          </form>
        </section>
      </div>
      <section className="overflow-hidden rounded-md border border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-4">
          <h2 className="text-xl font-bold">Mode Perbaikan</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Saat aktif, halaman non-administrator diarahkan ke halaman Dalam perbaikan.
          </p>
        </div>
        <form action={updateMaintenanceMode} className="grid gap-4 p-4">
          <label className="flex items-center gap-3 text-sm font-bold text-slate-700">
            <input
              className="size-4 accent-[#2f6696]"
              defaultChecked={isEnabled}
              name="enabled"
              type="checkbox"
            />
            Aktifkan mode perbaikan
          </label>
          <label className="grid gap-1 text-xs font-bold text-slate-500">
            Pesan
            <textarea
              className="min-h-28 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-700 outline-none focus:border-[#2f6696] focus:ring-2 focus:ring-[#2f6696]/20"
              defaultValue={message}
              name="message"
            />
          </label>
          <div className="flex justify-end">
            <SubmitButton className={buttonStyles.primary} pendingText="Menyimpan">
              Simpan
            </SubmitButton>
          </div>
        </form>
      </section>
    </>
  );
}
