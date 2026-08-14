import Link from "next/link";
import { redirect } from "next/navigation";
import { changePassword } from "@/app/auth/actions";
import { buttonGroups, buttonStyles } from "@/app/components/button-styles";
import { SubmitButton } from "@/app/components/submit-button";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ChangePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const params = await searchParams;

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#f3f6fb] px-6 text-slate-900">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-7 shadow-sm">
        <p className="text-sm font-bold text-[#2f6696]">Data Bayar Jawa Timur</p>
        <h1 className="mt-2 text-3xl font-bold">Ubah Password</h1>
        <p className="mt-2 text-sm font-semibold text-slate-500">{user.email}</p>

        {params.error && (
          <div className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {params.error}
          </div>
        )}

        {params.success === "1" && (
          <div className="mt-5 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            Password berhasil diubah.
          </div>
        )}

        <form action={changePassword} className="mt-6 grid gap-4">
          <label className="grid gap-2 text-sm font-bold text-slate-600">
            Password Lama
            <input
              autoComplete="current-password"
              className="h-12 rounded-md border border-slate-300 px-4 text-base font-normal outline-none focus:border-[#2f6696]"
              name="current_password"
              required
              type="password"
            />
          </label>
          <label className="grid gap-2 text-sm font-bold text-slate-600">
            Password Baru
            <input
              autoComplete="new-password"
              className="h-12 rounded-md border border-slate-300 px-4 text-base font-normal outline-none focus:border-[#2f6696]"
              minLength={8}
              name="new_password"
              required
              type="password"
            />
          </label>
          <label className="grid gap-2 text-sm font-bold text-slate-600">
            Konfirmasi Password Baru
            <input
              autoComplete="new-password"
              className="h-12 rounded-md border border-slate-300 px-4 text-base font-normal outline-none focus:border-[#2f6696]"
              minLength={8}
              name="confirm_password"
              required
              type="password"
            />
          </label>
          <div className={`${buttonGroups.toolbar} justify-end pt-2`}>
            <Link
              className={buttonStyles.secondary}
              href="/"
            >
              Batal
            </Link>
            <SubmitButton
              className={buttonStyles.primary}
              pendingText="Menyimpan"
            >
              Simpan
            </SubmitButton>
          </div>
        </form>
      </section>
    </main>
  );
}
