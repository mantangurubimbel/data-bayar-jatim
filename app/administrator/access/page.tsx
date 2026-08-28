import { updateAdminLimitedFilters } from "@/app/auth/actions";
import {
  type AdminLimitedPositionFilterRow,
  type AdminLimitedRoleFilterRow,
  type PositionRow,
  type RoleRow,
  requireAdminContext,
  isFullAdminRole,
} from "@/app/administrator/admin-utils";
import { PageHeader } from "@/app/administrator/page-header";
import { buttonStyles } from "@/app/components/button-styles";
import { SubmitButton } from "@/app/components/submit-button";

export default async function AdminAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const params = await searchParams;
  const { dataSupabase, profile } = await requireAdminContext();

  if (!isFullAdminRole(profile.role_id)) {
    return (
      <>
        <PageHeader description="Pengaturan filter Admin Terbatas." title="Akses Terbatas" />
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          Akses admin penuh dibutuhkan.
        </div>
      </>
    );
  }

  const [{ data: roles }, { data: positions }, { data: roleFilters }, { data: positionFilters }] = await Promise.all([
    dataSupabase
      .from("t_role")
      .select("role_id, role_name")
      .not("role_id", "in", "(admin,admin_limited)")
      .order("role_name"),
    dataSupabase.from("t_position").select("position_id, position_name").order("position_name"),
    dataSupabase.from("t_admin_limited_role_filter").select("role_id"),
    dataSupabase.from("t_admin_limited_position_filter").select("position_id"),
  ]);
  const rolesList = (roles ?? []) as RoleRow[];
  const positionsList = (positions ?? []) as PositionRow[];
  const selectedRoleIds = new Set(((roleFilters ?? []) as AdminLimitedRoleFilterRow[]).map((row) => row.role_id));
  const selectedPositionIds = new Set(
    ((positionFilters ?? []) as AdminLimitedPositionFilterRow[]).map((row) => row.position_id),
  );

  return (
    <>
      <PageHeader
        description="Tentukan role dan posisi user yang tampil untuk Admin Terbatas."
        title="Akses Terbatas"
      />
      {params.error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {params.error}
        </div>
      )}
      {params.success === "1" && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          Filter Admin Terbatas berhasil diperbarui.
        </div>
      )}

      <form action={updateAdminLimitedFilters} className="grid gap-4">
        <section className="overflow-hidden rounded-md border border-slate-200 bg-white">
          <div className="border-b border-slate-200 p-4">
            <h2 className="text-xl font-bold">Role Yang Ditampilkan</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Admin Terbatas hanya akan melihat user dengan role berikut.
            </p>
          </div>
          <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-4">
            {rolesList.map((role) => (
              <label
                className="flex min-h-10 cursor-pointer items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                key={role.role_id}
              >
                <input
                  className="size-4 accent-[#2f6696]"
                  defaultChecked={selectedRoleIds.has(role.role_id)}
                  name="role_ids"
                  type="checkbox"
                  value={role.role_id}
                />
                {role.role_name}
              </label>
            ))}
          </div>
        </section>

        <section className="overflow-hidden rounded-md border border-slate-200 bg-white">
          <div className="border-b border-slate-200 p-4">
            <h2 className="text-xl font-bold">Posisi Yang Ditampilkan</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Admin Terbatas hanya akan melihat user dengan posisi berikut.
            </p>
          </div>
          <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-4">
            {positionsList.map((position) => (
              <label
                className="flex min-h-10 cursor-pointer items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                key={position.position_id}
              >
                <input
                  className="size-4 accent-[#2f6696]"
                  defaultChecked={selectedPositionIds.has(position.position_id)}
                  name="position_ids"
                  type="checkbox"
                  value={position.position_id}
                />
                {position.position_name}
              </label>
            ))}
          </div>
        </section>

        <div className="flex justify-end">
          <SubmitButton className={buttonStyles.primary} pendingText="Menyimpan">
            Simpan Filter
          </SubmitButton>
        </div>
      </form>
    </>
  );
}
