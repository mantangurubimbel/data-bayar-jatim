import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

const schoolPageSize = 20;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const branchId = Number(searchParams.get("branch"));
  const currentPage = Math.max(Number(searchParams.get("schoolPage") ?? "1") || 1, 1);
  const from = (currentPage - 1) * schoolPageSize;
  const to = from + schoolPageSize - 1;

  if (!branchId) {
    return Response.json({
      currentPage,
      schools: [],
      totalPages: 1,
      totalSchools: 0,
    });
  }

  const supabase = createSupabaseServiceRoleClient();
  const { data, count, error } = await supabase
    .from("v_branch_school_detail")
    .select("npsn, school_name, level, school_status, student_count", { count: "exact" })
    .eq("branch_id", branchId)
    .order("student_count", { ascending: false })
    .order("school_name", { ascending: true })
    .range(from, to);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({
    currentPage,
    schools: data ?? [],
    totalPages: Math.max(Math.ceil((count ?? 0) / schoolPageSize), 1),
    totalSchools: count ?? 0,
  });
}
