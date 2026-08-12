import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

const rombelPageSize = 20;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const branchId = Number(searchParams.get("branch"));
  const academicYear = searchParams.get("year") ?? "";
  const currentPage = Math.max(Number(searchParams.get("rombelPage") ?? "1") || 1, 1);
  const from = (currentPage - 1) * rombelPageSize;
  const to = from + rombelPageSize - 1;

  if (!branchId || !academicYear) {
    return Response.json({
      currentPage,
      rombels: [],
      totalPages: 1,
      totalRombels: 0,
    });
  }

  const supabase = createSupabaseServiceRoleClient();
  const { data, count, error } = await supabase
    .from("v_rombel_detail")
    .select("rombel_id, grade, rombel_name, student_count", { count: "exact" })
    .eq("branch_id", branchId)
    .eq("academic_year", academicYear)
    .order("grade", { ascending: true })
    .order("rombel_name", { ascending: true })
    .range(from, to);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({
    currentPage,
    rombels: data ?? [],
    totalPages: Math.max(Math.ceil((count ?? 0) / rombelPageSize), 1),
    totalRombels: count ?? 0,
  });
}
