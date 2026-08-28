import { createSupabaseServerClient } from "@/lib/supabase/server";
import { signIn } from "@/app/auth/actions";
import { buttonStyles } from "@/app/components/button-styles";
import { PasswordInput } from "@/app/components/password-input";
import { SubmitButton } from "@/app/components/submit-button";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; force?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.getUser();
  const params = await searchParams;

  return (
    <main className="grid min-h-screen place-items-center bg-[#f3f6fb] px-6 text-slate-900">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-7 shadow-sm">
        <p className="text-sm font-bold text-[#2f6696]">Dashboard Jawa Timur v2.2</p>
        <h1 className="mt-2 text-3xl font-bold">Masuk Data Bayar</h1>
        <p className="mt-2 text-sm font-semibold text-slate-500">
          Gunakan akun Supabase Auth yang sudah terdaftar.
        </p>

        {params.error && (
          <div className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {params.error}
          </div>
        )}

        <form action={signIn} className="mt-6 grid gap-4">
          <label className="grid gap-2 text-sm font-bold text-slate-600">
            Email
            <input
              className="h-12 rounded-md border border-slate-300 px-4 text-base font-normal outline-none focus:border-[#2f6696]"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </label>
          <label className="grid gap-2 text-sm font-bold text-slate-600">
            Password
            <PasswordInput autoComplete="current-password" name="password" />
          </label>
          <SubmitButton
            className={`mt-2 ${buttonStyles.primaryLarge}`}
            pendingText="Masuk"
          >
            Masuk
          </SubmitButton>
        </form>
      </section>
    </main>
  );
}
