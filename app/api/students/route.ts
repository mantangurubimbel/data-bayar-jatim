import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

const pageSize = 20;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const branchId = Number(searchParams.get("branch"));
  const academicYear = searchParams.get("year") ?? "";
  const query = searchParams.get("q")?.trim() ?? "";
  const incompleteOnly = searchParams.get("incomplete") === "1";
  const loyalOnly = searchParams.get("loyal") === "1";
  const statusFilter = searchParams.get("status") ?? "";
  const currentPage = Math.max(Number(searchParams.get("page") ?? "1") || 1, 1);
  const from = (currentPage - 1) * pageSize;
  const to = from + pageSize - 1;

  if (!branchId || !academicYear) {
    return Response.json({
      currentPage,
      students: [],
      totalPages: 1,
      totalStudents: 0,
    });
  }

  const supabase = createSupabaseServiceRoleClient();
  let studentQuery = supabase
    .from("v_student_detail")
    .select("nis, user_name, school_name, grade, rombel_name, user_serial, is_incomplete, status", {
      count: "exact",
    })
    .eq("branch_id", branchId)
    .eq("academic_year", academicYear);

  if (query) {
    const escapedQuery = query.replaceAll("%", "\\%").replaceAll("_", "\\_");
    studentQuery = studentQuery.or(
      [
        `nis.ilike.%${escapedQuery}%`,
        `user_name.ilike.%${escapedQuery}%`,
        `school_name.ilike.%${escapedQuery}%`,
        `user_serial.ilike.%${escapedQuery}%`,
      ].join(","),
    );
  }

  if (incompleteOnly) {
    studentQuery = studentQuery.eq("is_incomplete", true);
  }
  if (statusFilter === "Active" || statusFilter === "Inactive") {
    studentQuery = studentQuery.eq("status", statusFilter);
  }
  if (loyalOnly) {
    const { data: currentYearSerialRows } = await supabase
      .from("v_student_detail")
      .select("user_serial")
      .eq("branch_id", branchId)
      .eq("academic_year", academicYear)
      .neq("status", "Deleted");
    const currentYearSerials = [
      ...new Set(
        (currentYearSerialRows ?? [])
          .map((student) => student.user_serial?.trim())
          .filter((serial): serial is string => Boolean(serial)),
      ),
    ];

    if (currentYearSerials.length === 0) {
      return Response.json({
        currentPage,
        students: [],
        totalPages: 1,
        totalStudents: 0,
      });
    }

    const { data: loyalSerialRows } = await supabase
      .from("v_student_detail")
      .select("user_serial")
      .in("user_serial", currentYearSerials)
      .neq("academic_year", academicYear)
      .neq("status", "Deleted");
    const loyalSerials = [
      ...new Set(
        (loyalSerialRows ?? [])
          .map((student) => student.user_serial?.trim())
          .filter((serial): serial is string => Boolean(serial)),
      ),
    ];

    if (loyalSerials.length === 0) {
      return Response.json({
        currentPage,
        students: [],
        totalPages: 1,
        totalStudents: 0,
      });
    }

    studentQuery = studentQuery.in("user_serial", loyalSerials);
  }

  const { data, count, error } = await studentQuery.order("nis", { ascending: false }).range(from, to);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({
    currentPage,
    students: data ?? [],
    totalPages: Math.max(Math.ceil((count ?? 0) / pageSize), 1),
    totalStudents: count ?? 0,
  });
}
