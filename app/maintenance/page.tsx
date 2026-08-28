import { Wrench } from "lucide-react";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export default async function MaintenancePage() {
  const dataSupabase = createSupabaseServiceRoleClient();
  const { data } = await dataSupabase
    .from("t_app_setting")
    .select("setting_value")
    .eq("setting_key", "maintenance")
    .maybeSingle();
  const value = (data?.setting_value ?? {}) as { message?: string };
  const message = value.message || "Dalam perbaikan";

  return (
    <main className="grid min-h-screen place-items-center bg-[#f3f6fb] px-6 text-slate-900">
      <section className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[#e8f1f8] text-[#2f6696]">
          <Wrench className="size-6" aria-hidden="true" />
        </div>
        <p className="mt-5 text-sm font-bold uppercase tracking-[0.16em] text-[#2f6696]">Data Bayar</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">Dalam perbaikan</h1>
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">{message}</p>
      </section>
    </main>
  );
}
