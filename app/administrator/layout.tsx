import Link from "next/link";
import type { ReactNode } from "react";
import { LayoutDashboard } from "lucide-react";
import { AdminNav } from "@/app/administrator/admin-nav";
import { isFullAdminRole } from "@/app/administrator/admin-utils";
import { buttonStyles } from "@/app/components/button-styles";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server";

export default async function AdministratorLayout({ children }: { children: ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const dataSupabase = createSupabaseServiceRoleClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await dataSupabase
        .from("t_app_user")
        .select("name, email, role_id")
        .eq("id", user.id)
        .maybeSingle()
    : { data: null };
  const displayName = profile?.name ?? user?.email ?? "Administrator";
  const displayEmail = profile?.email ?? user?.email ?? "";
  const isFullAdmin = isFullAdminRole(profile?.role_id);

  return (
    <main className="min-h-screen bg-[#f8fafc] font-[Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,Segoe_UI,sans-serif] text-[14px] text-slate-900 lg:pl-[208px]">
      <aside className="fixed left-0 top-0 hidden h-screen w-[208px] bg-[#171717] text-white lg:flex lg:flex-col">
        <div className="px-4 py-5">
          <h1 className="text-[20px] font-bold tracking-tight">Data Bayar</h1>
          <p className="mt-1 text-[13px] font-semibold text-white/55">Admin Console</p>
        </div>
        <nav className="grid gap-1 border-t border-white/5 px-2 py-4 text-[14px] font-bold text-white/80">
          <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-white/35">Main</p>
          <Link className="flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-white/10" href="/">
            <LayoutDashboard className="size-4" aria-hidden="true" />
            Dashboard
          </Link>
          <AdminNav isFullAdmin={isFullAdmin} />
        </nav>
        <div className="mt-auto border-t border-white/5 px-4 py-5 text-sm">
          <p className="truncate font-bold" title={displayName}>
            {displayName}
          </p>
          <p className="mt-1 truncate text-xs font-semibold text-white/50" title={displayEmail}>
            {displayEmail}
          </p>
        </div>
      </aside>

      <div className="lg:hidden">
        <div className="border-b border-slate-200 bg-white px-4 py-4">
          <p className="text-lg font-bold">Data Bayar Admin</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">Manajemen akses dan operasional</p>
        </div>
        <nav className="flex gap-2 overflow-x-auto border-b border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600">
          <Link className={buttonStyles.secondarySmall} href="/">
            Dashboard
          </Link>
          <Link className={buttonStyles.secondarySmall} href="/administrator">
            Overview
          </Link>
          <Link className={buttonStyles.secondarySmall} href="/administrator/operations">
            Operasional
          </Link>
          <Link className={buttonStyles.secondarySmall} href="/administrator/logs">
            Log
          </Link>
          <Link className={buttonStyles.secondarySmall} href="/administrator/users">
            User
          </Link>
        </nav>
      </div>

      <div className="grid w-full gap-4 px-5 py-5 lg:px-8">{children}</div>
    </main>
  );
}
