import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

async function getMaintenanceSetting() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return { enabled: false };
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/t_app_setting?setting_key=eq.maintenance&select=setting_value`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });
  if (!response.ok) {
    return { enabled: false };
  }

  const rows = (await response.json()) as { setting_value?: { enabled?: boolean } }[];
  return { enabled: Boolean(rows[0]?.setting_value?.enabled) };
}

async function isAdministrator(userId: string | undefined) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!userId || !supabaseUrl || !serviceRoleKey) {
    return false;
  }

  const response = await fetch(
    `${supabaseUrl}/rest/v1/t_app_user?id=eq.${encodeURIComponent(userId)}&select=role_id`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    },
  );

  if (!response.ok) {
    return false;
  }

  const rows = (await response.json()) as { role_id?: string }[];
  return rows[0]?.role_id === "admin" || rows[0]?.role_id === "admin_limited";
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAdministratorUser = await isAdministrator(user?.id);
  const isPublicPath =
    pathname.startsWith("/login") ||
    pathname.startsWith("/maintenance") ||
    pathname.startsWith("/api");
  const maintenance = await getMaintenanceSetting();

  if (!isPublicPath && maintenance.enabled && !isAdministratorUser) {
    const url = request.nextUrl.clone();
    url.pathname = "/maintenance";
    return NextResponse.rewrite(url);
  }

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
