"use server";

import { redirect } from "next/navigation";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server";
import { upsertStudentToSheet } from "@/lib/google-sheets";

type StudentAuditAction = "create" | "update" | "delete" | "mutate";
type SheetSyncAction = StudentAuditAction | "retry";
type AuditSnapshot = Record<string, string | number | null>;
type AuditEntityType = "student" | "rombel" | "branch_school" | "academic_year" | "master_data" | "user";

const rombelGradeMismatchMessage = "Nama rombel tidak sesuai dengan pilihan jenjang kelas";

function isRombelNameValidForGrade(gradeName: string | undefined, rombelName: string) {
  const expectedGradeNumber = gradeName?.match(/^\d+/)?.[0];
  const rombelPrefixNumber = rombelName.trim().match(/^\d+/)?.[0];

  if (!expectedGradeNumber || !rombelName.trim()) {
    return true;
  }

  if (expectedGradeNumber === "12") {
    return !rombelPrefixNumber || rombelPrefixNumber === "12";
  }

  return rombelPrefixNumber === expectedGradeNumber;
}


export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "").trim();
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/");
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function changePassword(formData: FormData) {
  const currentPassword = String(formData.get("current_password") ?? "").trim();
  const newPassword = String(formData.get("new_password") ?? "").trim();
  const confirmPassword = String(formData.get("confirm_password") ?? "").trim();
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    redirect("/login");
  }

  if (!currentPassword || !newPassword || !confirmPassword) {
    redirect("/ubah-password?error=Semua%20field%20wajib%20diisi.");
  }

  if (newPassword.length < 8) {
    redirect("/ubah-password?error=Password%20baru%20minimal%208%20karakter.");
  }

  if (newPassword !== confirmPassword) {
    redirect("/ubah-password?error=Konfirmasi%20password%20tidak%20sama.");
  }

  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });

  if (verifyError) {
    redirect("/ubah-password?error=Password%20lama%20tidak%20sesuai.");
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });

  if (error) {
    redirect(`/ubah-password?error=${encodeURIComponent(error.message)}`);
  }

  await supabase.auth.signOut();
  redirect("/login?success=Password%20berhasil%20diubah.%20Silakan%20masuk%20kembali.");
}

export async function createRombel(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const dataSupabase = createSupabaseServiceRoleClient();
  const academicYear = String(formData.get("academic_year") ?? "").trim();
  const branchId = Number(formData.get("branch_id"));
  const gradeId = Number(formData.get("grade_id"));
  const rombelName = String(formData.get("rombel_name") ?? "").trim();
  const redirectTo = String(formData.get("redirect_to") ?? "/").trim() || "/";
  const errorRedirectTo = redirectTo.includes("?")
    ? `${redirectTo}&addRombel=1`
    : `${redirectTo}?addRombel=1`;

  if (!academicYear || !branchId || !gradeId || !rombelName) {
    redirect(`${errorRedirectTo}&rombelError=${encodeURIComponent("Semua field wajib diisi.")}`);
  }

  const { data: selectedGrade } = await dataSupabase
    .from("t_grade")
    .select("grade")
    .eq("grade_id", gradeId)
    .maybeSingle();

  if (!isRombelNameValidForGrade(selectedGrade?.grade, rombelName)) {
    redirect(`${errorRedirectTo}&rombelError=${encodeURIComponent(rombelGradeMismatchMessage)}`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await dataSupabase
    .from("t_app_user")
    .select("role_id")
    .eq("id", user.id)
    .maybeSingle();

  const { data: branchAccess } = await dataSupabase
    .from("t_app_user_branch")
    .select("branch_id")
    .eq("user_id", user.id)
    .eq("branch_id", branchId)
    .maybeSingle();

  const canCreateRombel = profile?.role_id === "admin" || Boolean(branchAccess);

  if (!canCreateRombel) {
    redirect(`${errorRedirectTo}&rombelError=${encodeURIComponent("Tidak punya akses ke branch ini.")}`);
  }

  const newRombel = {
    academic_year: academicYear,
    branch_id: branchId,
    grade_id: gradeId,
    rombel_name: rombelName,
  };
  const { data: insertedRombel, error } = await dataSupabase
    .from("t_rombel")
    .insert(newRombel)
    .select("rombel_id")
    .single();

  if (error) {
    redirect(`${errorRedirectTo}&rombelError=${encodeURIComponent(error.message)}`);
  }

  await recordAdminAudit({
    entityType: "rombel",
    entityId: String(insertedRombel?.rombel_id ?? rombelName),
    action: "create",
    branchId,
    actorEmail: user.email ?? null,
    detail: { rombel_name: rombelName, academic_year: academicYear },
    afterData: { ...newRombel, rombel_id: insertedRombel?.rombel_id ?? null },
  });

  redirect(withRombelRefresh(redirectTo));
}

export async function updateRombel(formData: FormData) {
  const dataSupabase = createSupabaseServiceRoleClient();
  const rombelId = Number(formData.get("rombel_id"));
  const branchId = Number(formData.get("branch_id"));
  const rombelName = formString(formData, "rombel_name");
  const redirectTo = formString(formData, "redirect_to") || "/";
  const errorRedirectTo = redirectTo.includes("?")
    ? `${redirectTo}&editRombel=${rombelId}`
    : `${redirectTo}?editRombel=${rombelId}`;

  if (!rombelId || !branchId || !rombelName) {
    redirect(`${errorRedirectTo}&rombelError=${encodeURIComponent("Semua field wajib diisi.")}`);
  }

  const user = await requireCurrentUser();
  const { data: currentRombel } = await dataSupabase
    .from("t_rombel")
    .select("rombel_id, academic_year, branch_id, grade_id, rombel_name")
    .eq("rombel_id", rombelId)
    .maybeSingle();

  if (!currentRombel || Number(currentRombel.branch_id) !== branchId || !(await canManageBranch(user.id, branchId))) {
    redirect(redirectTo);
  }
  const academicYear = String(currentRombel.academic_year ?? "");
  const gradeId = Number(currentRombel.grade_id);

  const { data: selectedGrade } = await dataSupabase
    .from("t_grade")
    .select("grade")
    .eq("grade_id", gradeId)
    .maybeSingle();

  if (!isRombelNameValidForGrade(selectedGrade?.grade, rombelName)) {
    redirect(`${errorRedirectTo}&rombelError=${encodeURIComponent(rombelGradeMismatchMessage)}`);
  }

  const updatedRombel = {
    rombel_name: rombelName,
  };
  const { error } = await dataSupabase.from("t_rombel").update(updatedRombel).eq("rombel_id", rombelId);

  if (error) {
    redirect(`${errorRedirectTo}&rombelError=${encodeURIComponent(error.message)}`);
  }

  await recordAdminAudit({
    entityType: "rombel",
    entityId: String(rombelId),
    action: "update",
    branchId,
    actorEmail: user.email ?? null,
    detail: { rombel_name: rombelName, academic_year: academicYear },
    beforeData: {
      rombel_id: currentRombel.rombel_id,
      academic_year: currentRombel.academic_year,
      branch_id: currentRombel.branch_id,
      grade_id: currentRombel.grade_id,
      rombel_name: currentRombel.rombel_name,
    },
    afterData: { ...updatedRombel, rombel_id: rombelId },
  });

  redirect(withRombelRefresh(redirectTo));
}

export async function createBranchSchool(formData: FormData) {
  const dataSupabase = createSupabaseServiceRoleClient();
  const branchId = Number(formData.get("branch_id"));
  const npsn = formString(formData, "npsn");
  const redirectTo = formString(formData, "redirect_to") || "/";

  if (!branchId || !npsn) {
    redirect(redirectTo);
  }

  const user = await requireCurrentUser();

  if (!(await canManageBranch(user.id, branchId))) {
    redirect(redirectTo);
  }

  const { data: school } = await dataSupabase
    .from("t_master_school")
    .select("npsn, name, level, status, district, city, province")
    .eq("npsn", npsn)
    .maybeSingle();

  if (!school) {
    redirect(redirectTo);
  }

  const newBranchSchool = { npsn, branch_id: branchId };
  const { data: insertedBranchSchool, error } = await dataSupabase
    .from("t_branch_school")
    .insert(newBranchSchool)
    .select("id")
    .single();

  if (!error) {
    await recordAdminAudit({
      entityType: "branch_school",
      entityId: String(insertedBranchSchool?.id ?? `${branchId}:${npsn}`),
      action: "create",
      branchId,
      actorEmail: user.email ?? null,
      detail: { npsn, school_name: school.name },
      afterData: {
        id: insertedBranchSchool?.id ?? null,
        branch_id: branchId,
        npsn,
        school_name: school.name,
        level: school.level,
        status: school.status,
        district: school.district,
        city: school.city,
        province: school.province,
      },
    });
  }

  redirect(redirectTo);
}

function formString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function optionalString(formData: FormData, key: string) {
  const value = formString(formData, key);
  return value || null;
}

function optionalNumber(formData: FormData, key: string) {
  const value = Number(formData.get(key));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function isValidPhone(value: string | null) {
  return !value || /^[0-9]{8,15}$/.test(value);
}

function studentErrorRedirect(redirectTo: string, mode: "add" | "edit") {
  const modalParam = mode === "add" ? "addStudent=1" : "editStudent=1";
  return redirectTo.includes("?") ? `${redirectTo}&${modalParam}` : `${redirectTo}?${modalParam}`;
}

function withStudentRefresh(redirectTo: string) {
  const url = new URL(redirectTo, "http://localhost");
  url.searchParams.set("studentRefresh", String(Date.now()));
  return `${url.pathname}${url.search}`;
}

function withRombelRefresh(redirectTo: string) {
  const url = new URL(redirectTo, "http://localhost");
  url.searchParams.set("rombelRefresh", String(Date.now()));
  return `${url.pathname}${url.search}`;
}

async function requireCurrentUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

async function requireAdminUser() {
  const user = await requireCurrentUser();
  const dataSupabase = createSupabaseServiceRoleClient();
  const { data: profile } = await dataSupabase
    .from("t_app_user")
    .select("role_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role_id !== "admin") {
    redirect("/");
  }

  return user;
}

async function canManageBranch(userId: string, branchId: number) {
  const dataSupabase = createSupabaseServiceRoleClient();
  const { data: profile } = await dataSupabase
    .from("t_app_user")
    .select("role_id")
    .eq("id", userId)
    .maybeSingle();

  if (profile?.role_id === "admin") {
    return true;
  }

  const { data: branchAccess } = await dataSupabase
    .from("t_app_user_branch")
    .select("branch_id")
    .eq("user_id", userId)
    .eq("branch_id", branchId)
    .maybeSingle();

  return Boolean(branchAccess);
}

export async function updateUserAccess(formData: FormData) {
  await requireAdminUser();
  const dataSupabase = createSupabaseServiceRoleClient();
  const userId = formString(formData, "user_id");
  const name = optionalString(formData, "name");
  const position = optionalString(formData, "position");
  const roleId = formString(formData, "role_id") || "viewer";
  const branchIds = formData
    .getAll("branch_ids")
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (!userId) {
    redirect("/administrator?error=User%20tidak%20ditemukan.");
  }

  const { error: profileError } = await dataSupabase
    .from("t_app_user")
    .update({ name, position, role_id: roleId })
    .eq("id", userId);

  if (profileError) {
    redirect(`/administrator?error=${encodeURIComponent(profileError.message)}`);
  }

  const { error: deleteError } = await dataSupabase
    .from("t_app_user_branch")
    .delete()
    .eq("user_id", userId);

  if (deleteError) {
    redirect(`/administrator?error=${encodeURIComponent(deleteError.message)}`);
  }

  if (branchIds.length > 0) {
    const { error: insertError } = await dataSupabase.from("t_app_user_branch").insert(
      branchIds.map((branchId) => ({
        user_id: userId,
        branch_id: branchId,
      })),
    );

    if (insertError) {
      redirect(`/administrator?error=${encodeURIComponent(insertError.message)}`);
    }
  }

  redirect("/administrator?success=1");
}

async function generateStudentNis(branchId: number, academicYear: string) {
  const dataSupabase = createSupabaseServiceRoleClient();
  const yearCode = academicYear.slice(0, 2);
  const prefix = `0${branchId}-${yearCode}-`;
  const { data: latestStudent } = await dataSupabase
    .from("t_students")
    .select("nis")
    .like("nis", `${prefix}%`)
    .order("nis", { ascending: false })
    .limit(1)
    .maybeSingle();
  const latestSequence = Number(String(latestStudent?.nis ?? "").slice(-4));
  const nextSequence = Number.isFinite(latestSequence) ? latestSequence + 1 : 1;
  return `${prefix}${String(nextSequence).padStart(4, "0")}`;
}

async function syncStudentToSheet(nis: string) {
  const dataSupabase = createSupabaseServiceRoleClient();
  const { data: sheetStudent } = await dataSupabase
    .from("v_student_detail")
    .select(
      "nis, payment_date, academic_year, user_serial, user_name, user_phone, birth_date, email, grade, npsn, school_name, rombel_name, parents_name, parents_phone, agent_name, payment_method, status, branch_name, created_at, operator_email, level",
    )
    .eq("nis", nis)
    .maybeSingle();

  if (sheetStudent) {
    return upsertStudentToSheet(sheetStudent);
  }

  return { skipped: true };
}

function studentAuditSnapshot(student: {
  payment_date?: string | null;
  academic_year?: string | null;
  user_serial?: string | null;
  user_name?: string | null;
  user_phone?: string | null;
  birth_date?: string | null;
  email?: string | null;
  grade?: string | null;
  school_name?: string | null;
  rombel_name?: string | null;
  parents_name?: string | null;
  parents_phone?: string | null;
  agent_name?: string | null;
  payment_method?: string | null;
  status?: string | null;
  branch_name?: string | null;
}): AuditSnapshot {
  return {
    payment_date: student.payment_date ?? null,
    academic_year: student.academic_year ?? null,
    user_serial: student.user_serial ?? null,
    user_name: student.user_name ?? null,
    user_phone: student.user_phone ?? null,
    birth_date: student.birth_date ?? null,
    email: student.email ?? null,
    grade: student.grade ?? null,
    school_name: student.school_name ?? null,
    rombel_name: student.rombel_name ?? null,
    parents_name: student.parents_name ?? null,
    parents_phone: student.parents_phone ?? null,
    agent_name: student.agent_name ?? null,
    payment_method: student.payment_method ?? null,
    status: student.status ?? null,
    branch_name: student.branch_name ?? null,
  };
}

function changedAuditFields(beforeData: AuditSnapshot | null, afterData: AuditSnapshot | null) {
  if (!beforeData || !afterData) {
    return {};
  }

  return Object.fromEntries(
    Object.keys(afterData)
      .filter((key) => beforeData[key] !== afterData[key])
      .map((key) => [key, { before: beforeData[key] ?? null, after: afterData[key] ?? null }]),
  );
}

async function getStudentAuditSnapshot(nis: string) {
  const dataSupabase = createSupabaseServiceRoleClient();
  const { data: student } = await dataSupabase
    .from("v_student_detail")
    .select(
      "payment_date, academic_year, user_serial, user_name, user_phone, birth_date, email, grade, school_name, rombel_name, parents_name, parents_phone, agent_name, payment_method, status, branch_name",
    )
    .eq("nis", nis)
    .maybeSingle();

  return student ? studentAuditSnapshot(student) : null;
}

async function getBranchName(branchId: number) {
  const dataSupabase = createSupabaseServiceRoleClient();
  const { data: branch } = await dataSupabase
    .from("t_branch")
    .select("branch_name")
    .eq("branch_id", branchId)
    .maybeSingle();

  return branch?.branch_name ?? `Branch ${branchId}`;
}


async function recordAdminAudit({
  entityType,
  entityId,
  action,
  branchId,
  destinationBranchId,
  actorEmail,
  detail = {},
  beforeData = null,
  afterData = null,
}: {
  entityType: AuditEntityType;
  entityId: string;
  action: StudentAuditAction;
  branchId: number | null;
  destinationBranchId?: number | null;
  actorEmail: string | null;
  detail?: Record<string, string | number | null>;
  beforeData?: AuditSnapshot | null;
  afterData?: AuditSnapshot | null;
}) {
  const dataSupabase = createSupabaseServiceRoleClient();
  await dataSupabase.from("t_admin_audit_log").insert({
    entity_type: entityType,
    entity_id: entityId,
    action,
    branch_id: branchId,
    destination_branch_id: destinationBranchId ?? null,
    actor_email: actorEmail,
    detail: { ...detail, changed_fields: changedAuditFields(beforeData, afterData) },
    before_data: beforeData,
    after_data: afterData,
  });
}

async function recordStudentAudit({
  nis,
  action,
  branchId,
  destinationBranchId,
  actorEmail,
  detail = {},
  beforeData = null,
  afterData = null,
}: {
  nis: string;
  action: StudentAuditAction;
  branchId: number | null;
  destinationBranchId?: number | null;
  actorEmail: string | null;
  detail?: Record<string, string | number | null>;
  beforeData?: AuditSnapshot | null;
  afterData?: AuditSnapshot | null;
}) {
  await recordAdminAudit({
    entityType: "student",
    entityId: nis,
    action,
    branchId,
    destinationBranchId,
    actorEmail,
    detail,
    beforeData,
    afterData,
  });
}

async function recordSheetSync({
  nis,
  action,
  actorEmail,
  status,
  errorMessage,
}: {
  nis: string;
  action: SheetSyncAction;
  actorEmail: string | null;
  status: "success" | "failed" | "skipped";
  errorMessage?: string;
}) {
  const dataSupabase = createSupabaseServiceRoleClient();
  await dataSupabase.from("t_google_sheet_sync_log").insert({
    nis,
    action,
    status,
    actor_email: actorEmail,
    error_message: errorMessage ?? null,
    last_attempt_at: new Date().toISOString(),
  });
}

async function syncStudentToSheetWithLog(nis: string, action: SheetSyncAction, actorEmail: string | null) {
  try {
    const result = await syncStudentToSheet(nis);
    await recordSheetSync({
      nis,
      action,
      actorEmail,
      status: result.skipped ? "skipped" : "success",
    });
  } catch (sheetError) {
    const message = sheetError instanceof Error ? sheetError.message : String(sheetError);
    await recordSheetSync({ nis, action, actorEmail, status: "failed", errorMessage: message });
    console.error(sheetError);
  }
}

async function syncDeletedStudentToSheet(nis: string) {
  const dataSupabase = createSupabaseServiceRoleClient();
  const { data: student } = await dataSupabase
    .from("t_students")
    .select(
      `
        nis,
        payment_date,
        academic_year,
        user_serial,
        user_name,
        user_phone,
        birth_date,
        email,
        parents_name,
        parents_phone,
        status,
        created_at,
        operator,
        t_grade (grade, level),
        t_master_school (npsn, name),
        t_rombel (rombel_name),
        t_agent (agent_name),
        t_payment_method (payment_method),
        t_branch (branch_name)
      `,
    )
    .eq("nis", nis)
    .maybeSingle();

  if (!student) {
    return { skipped: true };
  }

  const grade = firstRelation(student.t_grade);
  const school = firstRelation(student.t_master_school);
  const rombel = firstRelation(student.t_rombel);
  const agent = firstRelation(student.t_agent);
  const paymentMethod = firstRelation(student.t_payment_method);
  const branch = firstRelation(student.t_branch);

  return upsertStudentToSheet({
    nis: student.nis,
    payment_date: student.payment_date,
    academic_year: student.academic_year,
    user_serial: student.user_serial,
    user_name: student.user_name,
    user_phone: student.user_phone,
    birth_date: student.birth_date,
    email: student.email,
    grade: grade?.grade ?? null,
    npsn: school?.npsn ?? "",
    school_name: school?.name ?? null,
    rombel_name: rombel?.rombel_name ?? null,
    parents_name: student.parents_name,
    parents_phone: student.parents_phone,
    agent_name: agent?.agent_name ?? null,
    payment_method: paymentMethod?.payment_method ?? null,
    status: student.status,
    branch_name: branch?.branch_name ?? null,
    created_at: student.created_at,
    operator_email: student.operator,
    level: grade?.level ?? null,
  });
}

export async function createStudent(formData: FormData) {
  const dataSupabase = createSupabaseServiceRoleClient();
  const branchId = Number(formData.get("branch_id"));
  const redirectTo = formString(formData, "redirect_to") || "/";
  const errorRedirectTo = studentErrorRedirect(redirectTo, "add");

  if (!branchId) {
    redirect(`${errorRedirectTo}&studentError=${encodeURIComponent("Branch tidak ditemukan.")}`);
  }

  const user = await requireCurrentUser();

  if (!(await canManageBranch(user.id, branchId))) {
    redirect(`${errorRedirectTo}&studentError=${encodeURIComponent("Tidak punya akses tambah siswa di branch ini.")}`);
  }

  const paymentDate = formString(formData, "payment_date");
  const academicYear = formString(formData, "academic_year");
  const userSerial = formString(formData, "user_serial");
  const userName = formString(formData, "user_name");
  const userPhone = formString(formData, "user_phone");
  const gradeId = optionalNumber(formData, "grade_id");
  const npsn = formString(formData, "school_npsn");
  const paymentId = optionalNumber(formData, "payment_id");
  const agentId = optionalNumber(formData, "agent_id");

  if (!paymentDate || !academicYear || !userSerial || !userName || !userPhone || !gradeId || !npsn || !paymentId || !agentId) {
    redirect(`${errorRedirectTo}&studentError=${encodeURIComponent("Field wajib belum lengkap.")}`);
  }

  const parentsPhone = optionalString(formData, "parents_phone");

  if (!isValidPhone(userPhone) || !isValidPhone(parentsPhone)) {
    redirect(`${errorRedirectTo}&studentError=${encodeURIComponent("No HP/WA harus angka 8-15 digit.")}`);
  }

  const { data: existingSerialStudent } = await dataSupabase
    .from("t_students")
    .select("nis")
    .eq("user_serial", userSerial)
    .eq("academic_year", academicYear)
    .neq("status", "Deleted")
    .limit(1)
    .maybeSingle();

  if (existingSerialStudent) {
    redirect(`${errorRedirectTo}&studentError=${encodeURIComponent("User tersebut telah ada di database.")}`);
  }

  const nis = await generateStudentNis(branchId, academicYear);
  const newStudent = {
    nis,
    payment_date: paymentDate,
    academic_year: academicYear,
    user_serial: userSerial,
    user_name: userName,
    user_phone: userPhone,
    birth_date: optionalString(formData, "birth_date"),
    email: formString(formData, "email"),
    grade_id: gradeId,
    npsn,
    rombel_id: optionalNumber(formData, "rombel_id"),
    parents_name: optionalString(formData, "parents_name"),
    parents_phone: parentsPhone,
    agent_id: agentId,
    payment_id: paymentId,
    status: "Active",
    branch_id: branchId,
    operator: user.email ?? null,
  };
  const { error } = await dataSupabase.from("t_students").insert(newStudent);

  if (error) {
    redirect(`${errorRedirectTo}&studentError=${encodeURIComponent(error.message)}`);
  }

  const afterData = await getStudentAuditSnapshot(nis);
  await recordStudentAudit({
    nis,
    action: "create",
    branchId,
    actorEmail: user.email ?? null,
    detail: { user_name: userName, academic_year: academicYear },
    afterData,
  });
  await syncStudentToSheetWithLog(nis, "create", user.email ?? null);

  redirect(withStudentRefresh(redirectTo));
}

export async function updateStudent(formData: FormData) {
  const dataSupabase = createSupabaseServiceRoleClient();
  const nis = formString(formData, "nis");
  const redirectTo = formString(formData, "redirect_to") || "/";
  const errorRedirectTo = studentErrorRedirect(redirectTo, "edit");

  if (!nis) {
    redirect(`${errorRedirectTo}&studentError=${encodeURIComponent("NIS tidak ditemukan.")}`);
  }

  const user = await requireCurrentUser();

  const { data: existingStudent } = await dataSupabase
    .from("t_students")
    .select(
      "payment_date, academic_year, user_serial, user_name, user_phone, birth_date, email, grade_id, npsn, rombel_id, parents_name, parents_phone, agent_id, payment_id, status, branch_id",
    )
    .eq("nis", nis)
    .maybeSingle();

  const branchId = Number(existingStudent?.branch_id);

  if (!branchId || !(await canManageBranch(user.id, branchId))) {
    redirect(`${errorRedirectTo}&studentError=${encodeURIComponent("Tidak punya akses edit siswa ini.")}`);
  }
  const beforeData = await getStudentAuditSnapshot(nis);

  const paymentDate = formString(formData, "payment_date");
  const academicYear = formString(formData, "academic_year");
  const userSerial = formString(formData, "user_serial");
  const userName = formString(formData, "user_name");
  const userPhone = formString(formData, "user_phone");
  const gradeId = optionalNumber(formData, "grade_id");
  const npsn = formString(formData, "school_npsn");
  const paymentId = optionalNumber(formData, "payment_id");
  const agentId = optionalNumber(formData, "agent_id");

  if (!paymentDate || !academicYear || !userSerial || !userName || !userPhone || !gradeId || !npsn || !paymentId || !agentId) {
    redirect(`${errorRedirectTo}&studentError=${encodeURIComponent("Field wajib belum lengkap.")}`);
  }

  const parentsPhone = optionalString(formData, "parents_phone");

  if (!isValidPhone(userPhone) || !isValidPhone(parentsPhone)) {
    redirect(`${errorRedirectTo}&studentError=${encodeURIComponent("No HP/WA harus angka 8-15 digit.")}`);
  }

  const { error } = await dataSupabase
    .from("t_students")
    .update({
      payment_date: paymentDate,
      academic_year: academicYear,
      user_serial: userSerial,
      user_name: userName,
      user_phone: userPhone,
      birth_date: optionalString(formData, "birth_date"),
      email: formString(formData, "email"),
      grade_id: gradeId,
      npsn,
      rombel_id: optionalNumber(formData, "rombel_id"),
      parents_name: optionalString(formData, "parents_name"),
      parents_phone: parentsPhone,
      agent_id: agentId,
      payment_id: paymentId,
      status: formString(formData, "status") || "Active",
      operator: user.email ?? null,
    })
    .eq("nis", nis);

  if (error) {
    redirect(`${errorRedirectTo}&studentError=${encodeURIComponent(error.message)}`);
  }

  const afterData = await getStudentAuditSnapshot(nis);
  await recordStudentAudit({
    nis,
    action: "update",
    branchId,
    actorEmail: user.email ?? null,
    detail: { user_name: userName, academic_year: academicYear },
    beforeData,
    afterData,
  });
  await syncStudentToSheetWithLog(nis, "update", user.email ?? null);

  redirect(withStudentRefresh(redirectTo));
}

export async function deleteRombel(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const dataSupabase = createSupabaseServiceRoleClient();
  const rombelId = Number(formData.get("rombel_id"));
  const redirectTo = formString(formData, "redirect_to") || "/";

  if (!rombelId) {
    redirect(redirectTo);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: rombel } = await dataSupabase
    .from("t_rombel")
    .select("rombel_id, academic_year, branch_id, grade_id, rombel_name")
    .eq("rombel_id", rombelId)
    .maybeSingle();

  const branchId = Number(rombel?.branch_id);

  if (!branchId || !(await canManageBranch(user.id, branchId))) {
    redirect(redirectTo);
  }

  const { count } = await dataSupabase
    .from("t_students")
    .select("nis", { count: "exact", head: true })
    .eq("rombel_id", rombelId)
    .neq("status", "Deleted");

  if ((count ?? 0) > 0) {
    redirect(redirectTo);
  }

  await dataSupabase.from("t_rombel").delete().eq("rombel_id", rombelId);
  await recordAdminAudit({
    entityType: "rombel",
    entityId: String(rombelId),
    action: "delete",
    branchId,
    actorEmail: user.email ?? null,
    detail: { rombel_name: rombel?.rombel_name ?? null, academic_year: rombel?.academic_year ?? null },
    beforeData: rombel
      ? {
          rombel_id: rombel.rombel_id,
          academic_year: rombel.academic_year,
          branch_id: rombel.branch_id,
          grade_id: rombel.grade_id,
          rombel_name: rombel.rombel_name,
        }
      : null,
    afterData: null,
  });

  redirect(withRombelRefresh(redirectTo));
}

export async function deleteStudent(formData: FormData) {
  const dataSupabase = createSupabaseServiceRoleClient();
  const nis = formString(formData, "nis");
  const redirectTo = formString(formData, "redirect_to") || "/";

  if (!nis) {
    redirect(redirectTo);
  }

  const user = await requireCurrentUser();
  const { data: student } = await dataSupabase
    .from("t_students")
    .select(
      "payment_date, academic_year, user_serial, user_name, user_phone, birth_date, email, grade_id, npsn, rombel_id, parents_name, parents_phone, agent_id, payment_id, status, branch_id",
    )
    .eq("nis", nis)
    .maybeSingle();
  const branchId = Number(student?.branch_id);
  const beforeData = await getStudentAuditSnapshot(nis);

  if (!branchId || !(await canManageBranch(user.id, branchId))) {
    redirect(redirectTo);
  }

  await dataSupabase
    .from("t_students")
    .update({
      status: "Deleted",
      rombel_id: null,
      operator: user.email ?? null,
    })
    .eq("nis", nis);

  await recordStudentAudit({
    nis,
    action: "delete",
    branchId,
    actorEmail: user.email ?? null,
    beforeData,
    afterData: beforeData ? { ...beforeData, status: "Deleted", rombel_name: null } : null,
  });

  try {
    const result = await syncDeletedStudentToSheet(nis);
    await recordSheetSync({
      nis,
      action: "delete",
      actorEmail: user.email ?? null,
      status: result.skipped ? "skipped" : "success",
    });
  } catch (sheetError) {
    const message = sheetError instanceof Error ? sheetError.message : String(sheetError);
    await recordSheetSync({
      nis,
      action: "delete",
      actorEmail: user.email ?? null,
      status: "failed",
      errorMessage: message,
    });
    console.error(sheetError);
  }

  redirect(withStudentRefresh(redirectTo));
}

export async function mutateStudent(formData: FormData) {
  const dataSupabase = createSupabaseServiceRoleClient();
  const nis = formString(formData, "nis");
  const destinationBranchId = Number(formData.get("branch_id"));
  const redirectTo = formString(formData, "redirect_to") || "/";

  if (!nis || !destinationBranchId) {
    redirect(redirectTo);
  }

  const user = await requireCurrentUser();
  const { data: student } = await dataSupabase
    .from("t_students")
    .select(
      "payment_date, academic_year, user_serial, user_name, user_phone, birth_date, email, grade_id, npsn, rombel_id, parents_name, parents_phone, agent_id, payment_id, status, branch_id",
    )
    .eq("nis", nis)
    .maybeSingle();
  const originBranchId = Number(student?.branch_id);
  const beforeData = await getStudentAuditSnapshot(nis);

  if (
    !originBranchId ||
    originBranchId === destinationBranchId ||
    !(await canManageBranch(user.id, originBranchId)) ||
    !(await canManageBranch(user.id, destinationBranchId))
  ) {
    redirect(redirectTo);
  }

  await dataSupabase
    .from("t_students")
    .update({
      branch_id: destinationBranchId,
      rombel_id: null,
      operator: user.email ?? null,
    })
    .eq("nis", nis);

  await recordStudentAudit({
    nis,
    action: "mutate",
    branchId: originBranchId,
    destinationBranchId,
    actorEmail: user.email ?? null,
    detail: { from_branch_id: originBranchId, to_branch_id: destinationBranchId },
    beforeData,
    afterData: beforeData
      ? { ...beforeData, branch_name: await getBranchName(destinationBranchId), rombel_name: null }
      : null,
  });
  await syncStudentToSheetWithLog(nis, "mutate", user.email ?? null);

  redirect(withStudentRefresh(redirectTo));
}

export async function retrySheetSync(formData: FormData) {
  const user = await requireAdminUser();
  const nis = formString(formData, "nis");
  const originalAction = formString(formData, "sync_action") as SheetSyncAction;

  if (!nis) {
    redirect("/administrator?error=NIS%20tidak%20ditemukan.");
  }

  if (originalAction === "delete") {
    try {
      const result = await syncDeletedStudentToSheet(nis);
      await recordSheetSync({
        nis,
        action: "retry",
        actorEmail: user.email ?? null,
        status: result.skipped ? "skipped" : "success",
      });
    } catch (sheetError) {
      const message = sheetError instanceof Error ? sheetError.message : String(sheetError);
      await recordSheetSync({
        nis,
        action: "retry",
        actorEmail: user.email ?? null,
        status: "failed",
        errorMessage: message,
      });
      console.error(sheetError);
    }
  } else {
    await syncStudentToSheetWithLog(nis, "retry", user.email ?? null);
  }

  redirect("/administrator?success=sync-retry");
}
