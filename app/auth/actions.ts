"use server";

import { redirect } from "next/navigation";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server";
import { isAdminRole, isFullAdminRole, isGuestPositionName } from "@/app/administrator/admin-utils";
import { upsertStudentToSheet } from "@/lib/google-sheets";

type StudentAuditAction = "create" | "update" | "delete" | "mutate";
type SheetSyncAction = StudentAuditAction | "retry";
type AuditSnapshot = Record<string, string | number | null>;
type StudentInsertRow = {
  nis: string;
  payment_date: string;
  academic_year: string;
  user_serial: string;
  user_name: string;
  user_phone: string;
  birth_date: string | null;
  email: string;
  grade_id: number | null;
  npsn: string | null;
  rombel_id: number | null;
  parents_name: string | null;
  parents_phone: string | null;
  agent_id: number | null;
  payment_id: number | null;
  status: string;
  branch_id: number;
  operator: string | null;
};
type AuditEntityType = "student" | "rombel" | "branch_school" | "academic_year" | "master_data" | "user";

const rombelGradeMismatchMessage = "Nama rombel tidak sesuai dengan pilihan jenjang kelas";
const futurePaymentDateMessage = "Tanggal bayar tidak boleh lebih dari tanggal hari ini.";

function jakartaTodayDateInputValue() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function isFuturePaymentDate(paymentDate: string) {
  return paymentDate > jakartaTodayDateInputValue();
}

function nextAcademicYear(academicYear: string) {
  const match = academicYear.match(/^(\d{2,4})\/(\d{2,4})$/);
  if (!match) {
    return null;
  }

  const [, startYear, endYear] = match;
  const nextStart = String(Number(startYear) + 1).padStart(startYear.length, "0");
  const nextEnd = String(Number(endYear) + 1).padStart(endYear.length, "0");
  return `${nextStart}/${nextEnd}`;
}

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

  redirect(withSchoolRefresh(redirectTo));
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

const defaultNewUserPassword = "Ruangguru2026";

async function findAuthUserByEmail(email: string) {
  const dataSupabase = createSupabaseServiceRoleClient();
  let page = 1;

  while (true) {
    const { data, error } = await dataSupabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

    if (error) {
      throw error;
    }

    const authUser = data.users.find((existingUser) => existingUser.email?.toLowerCase() === email);

    if (authUser || data.users.length < 1000) {
      return authUser ?? null;
    }

    page += 1;
  }
}

function getBranchIds(formData: FormData) {
  return formData
    .getAll("branch_ids")
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);
}

function getRoleIds(formData: FormData) {
  return formData
    .getAll("role_ids")
    .map((value) => String(value).trim())
    .filter(Boolean);
}

function getPositionIds(formData: FormData) {
  return formData
    .getAll("position_ids")
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);
}

async function getAdminLimitedAllowedRoleIds() {
  const dataSupabase = createSupabaseServiceRoleClient();
  const { data } = await dataSupabase.from("t_admin_limited_role_filter").select("role_id");
  return new Set((data ?? []).map((row) => row.role_id));
}

async function getAdminLimitedAllowedPositionIds() {
  const dataSupabase = createSupabaseServiceRoleClient();
  const { data } = await dataSupabase.from("t_admin_limited_position_filter").select("position_id");
  return new Set((data ?? []).map((row) => row.position_id));
}

async function isAdminLimitedAllowedPosition(positionId: number | null) {
  if (!positionId) {
    return false;
  }

  const allowedPositionIds = await getAdminLimitedAllowedPositionIds();
  return allowedPositionIds.has(positionId);
}

export async function updateAdminLimitedFilters(formData: FormData) {
  await requireFullAdminUser();
  const dataSupabase = createSupabaseServiceRoleClient();
  const roleIds = getRoleIds(formData).filter((roleId) => !isAdminRole(roleId));
  const positionIds = getPositionIds(formData);
  const { error: deleteRoleError } = await dataSupabase.from("t_admin_limited_role_filter").delete().neq("role_id", "");

  if (deleteRoleError) {
    redirect(`/administrator/access?error=${encodeURIComponent(deleteRoleError.message)}`);
  }

  if (roleIds.length > 0) {
    const { error } = await dataSupabase
      .from("t_admin_limited_role_filter")
      .insert(roleIds.map((roleId) => ({ role_id: roleId })));

    if (error) {
      redirect(`/administrator/access?error=${encodeURIComponent(error.message)}`);
    }
  }

  const { error: deletePositionError } = await dataSupabase
    .from("t_admin_limited_position_filter")
    .delete()
    .gt("position_id", 0);

  if (deletePositionError) {
    redirect(`/administrator/access?error=${encodeURIComponent(deletePositionError.message)}`);
  }

  if (positionIds.length > 0) {
    const { error } = await dataSupabase
      .from("t_admin_limited_position_filter")
      .insert(positionIds.map((positionId) => ({ position_id: positionId })));

    if (error) {
      redirect(`/administrator/access?error=${encodeURIComponent(error.message)}`);
    }
  }

  redirect("/administrator/access?success=1");
}

async function replaceUserBranches(userId: string, branchIds: number[]) {
  const dataSupabase = createSupabaseServiceRoleClient();
  const { error: deleteError } = await dataSupabase.from("t_app_user_branch").delete().eq("user_id", userId);

  if (deleteError) {
    return deleteError.message;
  }

  if (branchIds.length === 0) {
    return null;
  }

  const { error: insertError } = await dataSupabase.from("t_app_user_branch").insert(
    branchIds.map((branchId) => ({
      user_id: userId,
      branch_id: branchId,
    })),
  );

  return insertError?.message ?? null;
}

function parseDelimitedRows(text: string) {
  return text
    .trim()
    .split(/\r?\n/)
    .map((line) => line.split(line.includes("\t") ? "\t" : ",").map((cell) => cell.trim()))
    .filter((row) => row.some(Boolean));
}

function normalizeLookup(value: string) {
  return value.trim().toLowerCase();
}

function splitBulkBranches(value: string) {
  return value
    .split(/[;,]/)
    .map((branch) => branch.trim())
    .filter(Boolean);
}

function formBoolean(formData: FormData, key: string) {
  return ["1", "true", "yes", "ya", "on"].includes(String(formData.get(key) ?? "").trim().toLowerCase());
}

function parseBooleanCell(value: unknown) {
  return ["1", "true", "yes", "ya", "on"].includes(String(value ?? "").trim().toLowerCase());
}

async function syncSalesAgentForUser({
  agentId,
  branchIds,
  email,
  isSalesAgent,
  name,
  userId,
}: {
  agentId?: number;
  branchIds: number[];
  email: string;
  isSalesAgent: boolean;
  name: string | null;
  userId: string;
}) {
  const dataSupabase = createSupabaseServiceRoleClient();
  const { data: existingAgent } = await dataSupabase
    .from("t_agent")
    .select("agent_name")
    .eq("app_user_id", userId)
    .maybeSingle();
  const agentName = existingAgent?.agent_name || name || email || `Agent ${userId.slice(0, 8)}`;
  let error;

  if (isSalesAgent && branchIds.length === 1) {
    if (agentId) {
      ({ error } = await dataSupabase
        .from("t_agent")
        .update({ app_user_id: userId, is_active: true })
        .eq("agent_id", agentId));
    } else if (existingAgent) {
      ({ error } = await dataSupabase
        .from("t_agent")
        .update({
          agent_name: agentName,
          branch_id: branchIds[0],
          is_active: true,
        })
        .eq("app_user_id", userId));
    } else {
      ({ error } = await dataSupabase.from("t_agent").insert({
        app_user_id: userId,
        agent_name: agentName,
        branch_id: branchIds[0],
        is_active: true,
      }));
    }
  } else {
    ({ error } = await dataSupabase.from("t_agent").update({ is_active: false }).eq("app_user_id", userId));
  }

  return error?.message ?? null;
}

async function upsertAuthAppUser({
  agentId,
  branchIds,
  email,
  isSalesAgent,
  name,
  password,
  positionId,
  roleId,
}: {
  agentId?: number;
  branchIds: number[];
  email: string;
  isSalesAgent: boolean;
  name: string | null;
  password: string;
  positionId: number | null;
  roleId: string;
}) {
  const dataSupabase = createSupabaseServiceRoleClient();
  const { data: authData, error: createError } = await dataSupabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  let authUser = authData.user;

  if (createError && createError.message !== "A user with this email address has already been registered") {
    return createError.message;
  }

  if (!authUser) {
    authUser = await findAuthUserByEmail(email);
  }

  if (!authUser) {
    return "User auth tidak ditemukan.";
  }

  const { error: passwordError } = await dataSupabase.auth.admin.updateUserById(authUser.id, { password });

  if (passwordError) {
    return passwordError.message;
  }

  const { error: profileError } = await dataSupabase.from("t_app_user").upsert({
    id: authUser.id,
    name,
    email,
    position_id: positionId,
    role_id: roleId,
  });

  if (profileError) {
    return profileError.message;
  }

  const branchError = await replaceUserBranches(authUser.id, branchIds);
  if (branchError) {
    return branchError;
  }

  return syncSalesAgentForUser({
    agentId,
    branchIds,
    email,
    isSalesAgent,
    name,
    userId: authUser.id,
  });
}

export async function createUserFromAgent(formData: FormData) {
  const actor = await requireAdminUser();
  const dataSupabase = createSupabaseServiceRoleClient();
  const { data: actorProfile } = await dataSupabase
    .from("t_app_user")
    .select("role_id")
    .eq("id", actor.id)
    .maybeSingle();
  const agentId = Number(formData.get("agent_id"));
  const email = formString(formData, "email").toLowerCase();
  const positionId = optionalNumber(formData, "position_id");
  const roleId = formString(formData, "role_id") || "viewer";
  const branchIds = getBranchIds(formData);
  const { data: agent } = await dataSupabase
    .from("t_agent")
    .select("agent_id, agent_name, agent_email, branch_id, app_user_id, is_active")
    .eq("agent_id", agentId)
    .maybeSingle();

  if (!agent || !agent.is_active || agent.app_user_id || !agent.branch_id) {
    redirect("/administrator/users?error=Agent%20aktif%20tidak%20valid.");
  }

  if (!agent.agent_email || email !== agent.agent_email.toLowerCase()) {
    redirect("/administrator/users?error=Email%20user%20tidak%20valid.");
  }

  if (branchIds.length !== 1 || branchIds[0] !== agent.branch_id) {
    redirect("/administrator/users?error=Branch%20user%20harus%20sama%20dengan%20branch%20agent.");
  }

  if (!isFullAdminRole(actorProfile?.role_id)) {
    const [allowedRoleIds, isAllowedPosition] = await Promise.all([
      getAdminLimitedAllowedRoleIds(),
      isAdminLimitedAllowedPosition(positionId),
    ]);

    if (isAdminRole(roleId) || !allowedRoleIds.has(roleId)) {
      redirect("/administrator/users?error=Role%20di%20luar%20akses%20Admin%20Terbatas.");
    }

    if (!isAllowedPosition) {
      redirect("/administrator/users?error=Posisi%20di%20luar%20akses%20Admin%20Terbatas.");
    }

    if (!(await canManageBranchInSameRegion(actor.id, agent.branch_id))) {
      redirect("/administrator/users?error=Agent%20di%20luar%20regional%20Admin%20Terbatas.");
    }
  }

  const error = await upsertAuthAppUser({
    agentId,
    branchIds,
    email: agent.agent_email,
    isSalesAgent: true,
    name: agent.agent_name,
    password: defaultNewUserPassword,
    positionId,
    roleId,
  });

  if (error) {
    redirect(`/administrator/users?error=${encodeURIComponent(error)}`);
  }

  redirect("/administrator/users?success=user-created");
}

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function isValidPhone(value: string | null) {
  return !value || /^[0-9]{8,15}$/.test(value);
}

const invalidEmailMessage = "Domain email sepertinya salah. Periksa kembali alamat email.";
const disposableEmailDomains = new Set([
  "10minutemail.com",
  "guerrillamail.com",
  "mailinator.com",
  "tempmail.com",
  "temp-mail.org",
  "yopmail.com",
]);
const typoEmailDomains = new Set([
  "gmai.com",
  "gmail.co",
  "gmail.con",
  "gmial.com",
  "gnail.com",
  "yaho.com",
  "yahoo.co",
  "yahoo.con",
  "yahho.com",
]);

function normalizeValidEmail(formData: FormData, key: string) {
  const rawValue = String(formData.get(key) ?? "");
  const email = rawValue.trim().toLowerCase();
  const domain = email.split("@")[1] ?? "";
  const isValidFormat = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  if (
    !email ||
    /\s/.test(email) ||
    !isValidFormat ||
    disposableEmailDomains.has(domain) ||
    typoEmailDomains.has(domain)
  ) {
    return null;
  }

  return email;
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

function withSchoolRefresh(redirectTo: string) {
  const url = new URL(redirectTo, "http://localhost");
  url.searchParams.set("schoolRefresh", String(Date.now()));
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

  if (!isAdminRole(profile?.role_id)) {
    redirect("/");
  }

  return user;
}

async function requireFullAdminUser() {
  const user = await requireCurrentUser();
  const dataSupabase = createSupabaseServiceRoleClient();
  const { data: profile } = await dataSupabase
    .from("t_app_user")
    .select("role_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!isFullAdminRole(profile?.role_id)) {
    redirect("/administrator/users?error=Akses%20admin%20penuh%20dibutuhkan.");
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

  if (isFullAdminRole(profile?.role_id)) {
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

async function canManageBranchInSameRegion(userId: string, branchId: number) {
  const dataSupabase = createSupabaseServiceRoleClient();
  const { data: profile } = await dataSupabase
    .from("t_app_user")
    .select("role_id")
    .eq("id", userId)
    .maybeSingle();

  if (isFullAdminRole(profile?.role_id)) {
    return true;
  }

  if (branchId === 100) {
    return false;
  }

  const [{ data: targetBranch }, { data: actorBranches }] = await Promise.all([
    dataSupabase.from("t_branch").select("region_id").eq("branch_id", branchId).maybeSingle(),
    dataSupabase.from("t_app_user_branch").select("branch_id").eq("user_id", userId),
  ]);
  const actorBranchIds = (actorBranches ?? []).map((row) => row.branch_id);

  if (typeof targetBranch?.region_id !== "number" || actorBranchIds.length === 0) {
    return false;
  }

  const { data: actorRegions } = await dataSupabase
    .from("t_branch")
    .select("region_id")
    .in("branch_id", actorBranchIds)
    .not("region_id", "is", null);

  return (actorRegions ?? []).some(
    (row) => typeof row.region_id === "number" && row.region_id === targetBranch.region_id,
  );
}

export async function updateAgentStatus(formData: FormData) {
  const user = await requireAdminUser();
  const dataSupabase = createSupabaseServiceRoleClient();
  const agentId = Number(formData.get("agent_id"));
  const isActive = formData.get("is_active") === "on";
  const status = formString(formData, "status") || "active";

  if (!Number.isFinite(agentId) || agentId <= 0) {
    redirect(`/administrator/agents?status=${status}&error=Agent%20tidak%20valid.`);
  }

  const { data: agent } = await dataSupabase
    .from("t_agent")
    .select("branch_id")
    .eq("agent_id", agentId)
    .maybeSingle();

  if (!agent) {
    redirect(`/administrator/agents?status=${status}&error=Agent%20tidak%20ditemukan.`);
  }

  if (agent.branch_id !== null && !(await canManageBranch(user.id, agent.branch_id))) {
    redirect(`/administrator/agents?status=${status}&error=Agent%20di%20luar%20akses%20branch.`);
  }

  const { error } = await dataSupabase.from("t_agent").update({ is_active: isActive }).eq("agent_id", agentId);

  if (error) {
    redirect(`/administrator/agents?status=${status}&error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/administrator/agents?status=${status}&success=1`);
}

async function getManageableBranchIds(userId: string) {
  const dataSupabase = createSupabaseServiceRoleClient();
  const { data } = await dataSupabase.from("t_app_user_branch").select("branch_id").eq("user_id", userId);
  return (data ?? []).map((row) => row.branch_id);
}

async function isAdminLimitedManageableUser(userId: string, actorBranchIds: number[]) {
  const dataSupabase = createSupabaseServiceRoleClient();
  const { data: targetUser } = await dataSupabase
    .from("t_app_user")
    .select("role_id, position_id, t_position(position_name)")
    .eq("id", userId)
    .maybeSingle();

  if (!targetUser || isAdminRole(targetUser.role_id)) {
    return false;
  }

  const allowedRoleIds = await getAdminLimitedAllowedRoleIds();
  if (!allowedRoleIds.has(targetUser.role_id)) {
    return false;
  }

  const targetPosition = firstRelation(targetUser.t_position);
  if (isGuestPositionName(targetPosition?.position_name) || !targetUser.position_id) {
    return false;
  }

  const allowedPositionIds = await getAdminLimitedAllowedPositionIds();
  if (!allowedPositionIds.has(targetUser.position_id)) {
    return false;
  }

  const { data: targetBranches } = await dataSupabase
    .from("t_app_user_branch")
    .select("branch_id")
    .eq("user_id", userId);
  const actorBranchIdSet = new Set(actorBranchIds);
  return (targetBranches ?? []).some((row) => actorBranchIdSet.has(row.branch_id));
}

export async function updateUserAccess(formData: FormData) {
  const actor = await requireAdminUser();
  const dataSupabase = createSupabaseServiceRoleClient();
  const { data: actorProfile } = await dataSupabase
    .from("t_app_user")
    .select("role_id")
    .eq("id", actor.id)
    .maybeSingle();
  const userId = formString(formData, "user_id");
  const name = optionalString(formData, "name");
  const positionId = optionalNumber(formData, "position_id");
  const roleId = formString(formData, "role_id") || "viewer";
  const branchIds = getBranchIds(formData);
  const isSalesAgent = formBoolean(formData, "sales_agent");

  if (!isFullAdminRole(actorProfile?.role_id)) {
    if (isAdminRole(roleId)) {
      redirect("/administrator/users?error=Admin%20terbatas%20tidak%20bisa%20memberi%20role%20admin.");
    }

    const [allowedRoleIds, isAllowedPosition, actorBranchIds] = await Promise.all([
      getAdminLimitedAllowedRoleIds(),
      isAdminLimitedAllowedPosition(positionId),
      getManageableBranchIds(actor.id),
    ]);

    if (!allowedRoleIds.has(roleId)) {
      redirect("/administrator/users?error=Role%20di%20luar%20akses%20Admin%20Terbatas.");
    }

    if (!isAllowedPosition) {
      redirect("/administrator/users?error=Posisi%20di%20luar%20akses%20Admin%20Terbatas.");
    }

    if (userId && !(await isAdminLimitedManageableUser(userId, actorBranchIds))) {
      redirect("/administrator/users?error=User%20di%20luar%20akses%20Admin%20Terbatas.");
    }

    const canManageAllBranches = await Promise.all(
      branchIds.map((branchId) => canManageBranchInSameRegion(actor.id, branchId)),
    );

    if (branchIds.includes(100)) {
      redirect("/administrator/users?error=Admin%20terbatas%20tidak%20bisa%20mengakses%20branch%20testing.");
    }

    if (canManageAllBranches.some((canManage) => !canManage)) {
      redirect("/administrator/users?error=Admin%20terbatas%20tidak%20bisa%20mengubah%20branch%20di%20luar%20aksesnya.");
    }
  }

  if (!userId) {
    redirect("/administrator/users?error=User%20tidak%20ditemukan.");
  }

  if (isSalesAgent && branchIds.length !== 1) {
    redirect("/administrator/users?error=Sales%20agent%20harus%20punya%20tepat%201%20branch.");
  }

  const { error: profileError } = await dataSupabase
    .from("t_app_user")
    .update({ name, position_id: positionId, role_id: roleId })
    .eq("id", userId);

  if (profileError) {
    redirect(`/administrator/users?error=${encodeURIComponent(profileError.message)}`);
  }

  const branchError = await replaceUserBranches(userId, branchIds);

  if (branchError) {
    redirect(`/administrator/users?error=${encodeURIComponent(branchError)}`);
  }

  const agentError = await syncSalesAgentForUser({
    branchIds,
    email: "",
    isSalesAgent,
    name,
    userId,
  });

  if (agentError) {
    redirect(`/administrator/users?error=${encodeURIComponent(agentError)}`);
  }

  redirect("/administrator/users?success=1");
}

export async function deleteAppUser(formData: FormData) {
  const currentUser = await requireFullAdminUser();
  const dataSupabase = createSupabaseServiceRoleClient();
  const userId = formString(formData, "user_id");

  if (!userId) {
    redirect("/administrator/users?error=User%20tidak%20ditemukan.");
  }

  if (userId === currentUser.id) {
    redirect("/administrator/users?error=Admin%20tidak%20bisa%20menghapus%20akun%20sendiri.");
  }

  const { error } = await dataSupabase.auth.admin.deleteUser(userId);

  if (error) {
    redirect(`/administrator/users?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/administrator/users?success=user-deleted");
}

export async function createSingleUser(formData: FormData) {
  const actor = await requireAdminUser();
  const dataSupabase = createSupabaseServiceRoleClient();
  const { data: actorProfile } = await dataSupabase
    .from("t_app_user")
    .select("role_id")
    .eq("id", actor.id)
    .maybeSingle();
  const name = optionalString(formData, "name");
  const email = formString(formData, "email").toLowerCase();
  const positionId = optionalNumber(formData, "position_id");
  const roleId = formString(formData, "role_id") || "viewer";
  const branchIds = getBranchIds(formData);
  const isSalesAgent = formBoolean(formData, "sales_agent");

  if (!isFullAdminRole(actorProfile?.role_id)) {
    if (isAdminRole(roleId)) {
      redirect("/administrator/users?error=Admin%20terbatas%20tidak%20bisa%20membuat%20role%20admin.");
    }

    const [allowedRoleIds, isAllowedPosition] = await Promise.all([
      getAdminLimitedAllowedRoleIds(),
      isAdminLimitedAllowedPosition(positionId),
    ]);

    if (!allowedRoleIds.has(roleId)) {
      redirect("/administrator/users?error=Role%20di%20luar%20akses%20Admin%20Terbatas.");
    }

    if (!isAllowedPosition) {
      redirect("/administrator/users?error=Posisi%20di%20luar%20akses%20Admin%20Terbatas.");
    }

    const canManageAllBranches = await Promise.all(
      branchIds.map((branchId) => canManageBranchInSameRegion(actor.id, branchId)),
    );

    if (branchIds.includes(100)) {
      redirect("/administrator/users?error=Admin%20terbatas%20tidak%20bisa%20mengakses%20branch%20testing.");
    }

    if (canManageAllBranches.some((canManage) => !canManage)) {
      redirect("/administrator/users?error=Admin%20terbatas%20tidak%20bisa%20memberi%20branch%20di%20luar%20aksesnya.");
    }
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    redirect("/administrator/users?error=Email%20user%20tidak%20valid.");
  }

  if (isSalesAgent && branchIds.length !== 1) {
    redirect("/administrator/users?error=Sales%20agent%20harus%20punya%20tepat%201%20branch.");
  }

  const error = await upsertAuthAppUser({
    branchIds,
    email,
    isSalesAgent,
    name,
    password: defaultNewUserPassword,
    positionId,
    roleId,
  });

  if (error) {
    redirect(`/administrator/users?error=${encodeURIComponent(error)}`);
  }

  redirect("/administrator/users?success=user-created");
}

export async function bulkImportUsers(formData: FormData) {
  await requireFullAdminUser();
  const dataSupabase = createSupabaseServiceRoleClient();
  const rawText = formString(formData, "bulk_users");

  if (!rawText) {
    redirect("/administrator/users?error=Data%20bulk%20user%20masih%20kosong.");
  }

  const rows = parseDelimitedRows(rawText);

  if (rows.length < 2) {
    redirect("/administrator/users?error=Data%20bulk%20minimal%20berisi%20header%20dan%201%20baris.");
  }

  const headers = rows[0].map((header) => normalizeLookup(header));
  const { data: roles } = await dataSupabase.from("t_role").select("role_id, role_name");
  const { data: positions } = await dataSupabase.from("t_position").select("position_id, position_name");
  const { data: branches } = await dataSupabase.from("t_branch").select("branch_id, branch_name");
  const roleByName = new Map(
    (roles ?? []).flatMap((role) => [
      [normalizeLookup(role.role_id), role.role_id],
      [normalizeLookup(role.role_name), role.role_id],
    ]),
  );
  const positionByName = new Map(
    (positions ?? []).map((position) => [normalizeLookup(position.position_name), position.position_id]),
  );
  const branchByName = new Map(
    (branches ?? []).flatMap((branch) => [
      [normalizeLookup(String(branch.branch_id)), branch.branch_id],
      [normalizeLookup(branch.branch_name), branch.branch_id],
    ]),
  );
  let successCount = 0;
  const errors: string[] = [];

  for (const [index, row] of rows.slice(1).entries()) {
    const record = Object.fromEntries(headers.map((header, cellIndex) => [header, row[cellIndex] ?? ""]));
    const email = String(record.email ?? "").trim().toLowerCase();
    const name = String(record.name ?? record.nama ?? "").trim() || null;
    const roleId = roleByName.get(normalizeLookup(String(record.role ?? record.role_id ?? ""))) ?? "viewer";
    const positionRaw = String(record.position ?? record.posisi ?? record.position_name ?? "").trim();
    const positionId = positionRaw ? (positionByName.get(normalizeLookup(positionRaw)) ?? null) : null;
    const branchValues = splitBulkBranches(String(record.branches ?? record.branch ?? record.branch_name ?? ""));
    const branchIds = branchValues.map((branch) => branchByName.get(normalizeLookup(branch))).filter(Boolean) as number[];
    const isSalesAgent = parseBooleanCell(record.sales_agent ?? record.agent ?? record.is_agent);

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push(`Baris ${index + 2}: email tidak valid`);
      continue;
    }

    if (positionRaw && !positionId) {
      errors.push(`Baris ${index + 2}: posisi tidak dikenal`);
      continue;
    }

    if (branchValues.length !== branchIds.length) {
      errors.push(`Baris ${index + 2}: branch tidak dikenal`);
      continue;
    }

    if (isSalesAgent && branchIds.length !== 1) {
      errors.push(`Baris ${index + 2}: sales_agent hanya boleh punya 1 branch`);
      continue;
    }

    const error = await upsertAuthAppUser({
      branchIds,
      email,
      isSalesAgent,
      name,
      password: String(record.password ?? "").trim() || defaultNewUserPassword,
      positionId,
      roleId,
    });

    if (error) {
      errors.push(`Baris ${index + 2}: ${error}`);
      continue;
    }

    successCount += 1;
  }

  const success = `bulk-${successCount}`;
  const query = new URLSearchParams({ success });

  if (errors.length > 0) {
    query.set("error", errors.slice(0, 3).join("; "));
  }

  redirect(`/administrator/users?${query.toString()}`);
}

function generateTemporaryPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const randomValues = crypto.getRandomValues(new Uint8Array(14));
  const passwordBody = Array.from(randomValues, (value) => alphabet[value % alphabet.length]).join("");

  return `${passwordBody}!7`;
}

export async function generateUserPassword(userId: string) {
  await requireFullAdminUser();

  if (!userId) {
    return { error: "User tidak ditemukan.", password: null };
  }

  const dataSupabase = createSupabaseServiceRoleClient();
  const password = generateTemporaryPassword();
  const { error } = await dataSupabase.auth.admin.updateUserById(userId, {
    password,
  });

  if (error) {
    return { error: error.message, password: null };
  }

  return { error: null, password };
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

async function ensureAcademicYear(academicYear: string) {
  const dataSupabase = createSupabaseServiceRoleClient();
  const { error } = await dataSupabase.from("t_academic_year").upsert(
    {
      academic_year: academicYear,
      is_active: false,
    },
    { onConflict: "academic_year", ignoreDuplicates: true },
  );

  return error?.message ?? null;
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
  const email = normalizeValidEmail(formData, "email");
  const gradeId = optionalNumber(formData, "grade_id");
  const npsn = formString(formData, "school_npsn");
  const paymentId = optionalNumber(formData, "payment_id");
  const agentId = optionalNumber(formData, "agent_id");

  if (!paymentDate || !academicYear || !userSerial || !userName || !userPhone || !gradeId || !npsn || !paymentId || !agentId) {
    redirect(`${errorRedirectTo}&studentError=${encodeURIComponent("Field wajib belum lengkap.")}`);
  }

  if (isFuturePaymentDate(paymentDate)) {
    redirect(`${errorRedirectTo}&studentError=${encodeURIComponent(futurePaymentDateMessage)}`);
  }

  if (!email) {
    redirect(`${errorRedirectTo}&studentError=${encodeURIComponent(invalidEmailMessage)}`);
  }

  const parentsPhone = optionalString(formData, "parents_phone");
  const shouldCreateNextAcademicYear = formBoolean(formData, "create_next_academic_year");
  const targetAcademicYears = [academicYear];
  const followingAcademicYear = shouldCreateNextAcademicYear ? nextAcademicYear(academicYear) : null;

  if (shouldCreateNextAcademicYear) {
    if (!followingAcademicYear) {
      redirect(`${errorRedirectTo}&studentError=${encodeURIComponent("Format tahun ajaran tidak valid.")}`);
    }
    targetAcademicYears.push(followingAcademicYear);
  }

  if (!isValidPhone(userPhone) || !isValidPhone(parentsPhone)) {
    redirect(`${errorRedirectTo}&studentError=${encodeURIComponent("No HP/WA harus angka 8-15 digit.")}`);
  }

  const { data: existingSerialStudents } = await dataSupabase
    .from("t_students")
    .select("academic_year, nis")
    .eq("user_serial", userSerial)
    .in("academic_year", targetAcademicYears)
    .neq("status", "Deleted")
    .limit(targetAcademicYears.length);

  if (existingSerialStudents?.length) {
    const duplicatedYears = existingSerialStudents.map((student) => student.academic_year).filter(Boolean).join(", ");
    redirect(
      `${errorRedirectTo}&studentError=${encodeURIComponent(`User tersebut telah ada di database tahun ajaran ${duplicatedYears}.`)}`,
    );
  }

  if (followingAcademicYear) {
    const yearError = await ensureAcademicYear(followingAcademicYear);

    if (yearError) {
      redirect(`${errorRedirectTo}&studentError=${encodeURIComponent(yearError)}`);
    }
  }

  const nis = await generateStudentNis(branchId, academicYear);
  const primaryStudent: StudentInsertRow = {
    nis,
    payment_date: paymentDate,
    academic_year: academicYear,
    user_serial: userSerial,
    user_name: userName,
    user_phone: userPhone,
    birth_date: optionalString(formData, "birth_date"),
    email,
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
  const studentsToInsert = [primaryStudent];

  if (followingAcademicYear) {
    studentsToInsert.push({
      ...primaryStudent,
      nis: await generateStudentNis(branchId, followingAcademicYear),
      academic_year: followingAcademicYear,
      grade_id: null,
      npsn: null,
      rombel_id: null,
    });
  }

  const { error } = await dataSupabase.from("t_students").insert(studentsToInsert);

  if (error) {
    redirect(`${errorRedirectTo}&studentError=${encodeURIComponent(error.message)}`);
  }

  for (const student of studentsToInsert) {
    const afterData = await getStudentAuditSnapshot(student.nis);
    await recordStudentAudit({
      nis: student.nis,
      action: "create",
      branchId,
      actorEmail: user.email ?? null,
      detail: { user_name: userName, academic_year: student.academic_year },
      afterData,
    });
    await syncStudentToSheetWithLog(student.nis, "create", user.email ?? null);
  }

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
  const academicYear = String(existingStudent?.academic_year ?? "");
  const userSerial = formString(formData, "user_serial");
  const userName = formString(formData, "user_name");
  const userPhone = formString(formData, "user_phone");
  const email = normalizeValidEmail(formData, "email");
  const gradeId = optionalNumber(formData, "grade_id");
  const npsn = formString(formData, "school_npsn");
  const paymentId = optionalNumber(formData, "payment_id");
  const agentId = optionalNumber(formData, "agent_id");

  if (!paymentDate || !academicYear || !userSerial || !userName || !userPhone || !gradeId || !npsn || !paymentId || !agentId) {
    redirect(`${errorRedirectTo}&studentError=${encodeURIComponent("Field wajib belum lengkap.")}`);
  }

  if (isFuturePaymentDate(paymentDate)) {
    redirect(`${errorRedirectTo}&studentError=${encodeURIComponent(futurePaymentDateMessage)}`);
  }

  if (!email) {
    redirect(`${errorRedirectTo}&studentError=${encodeURIComponent(invalidEmailMessage)}`);
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
      email,
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
    redirect("/administrator/logs?error=NIS%20tidak%20ditemukan.");
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

  redirect("/administrator/logs?success=sync-retry");
}

export async function updateMaintenanceMode(formData: FormData) {
  await requireFullAdminUser();
  const dataSupabase = createSupabaseServiceRoleClient();
  const enabled = formBoolean(formData, "enabled");
  const message = formString(formData, "message") || "Dalam perbaikan";
  const { error } = await dataSupabase.from("t_app_setting").upsert(
    {
      setting_key: "maintenance",
      setting_value: { enabled, message },
    },
    { onConflict: "setting_key" },
  );

  if (error) {
    redirect(`/administrator/settings?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/administrator/settings?success=1");
}

export async function updateAcademicYearStatus(formData: FormData) {
  await requireFullAdminUser();
  const dataSupabase = createSupabaseServiceRoleClient();
  const academicYear = formString(formData, "academic_year");
  const isActive = formBoolean(formData, "is_active");

  if (!academicYear) {
    redirect("/administrator/settings?error=Tahun%20ajaran%20tidak%20valid.");
  }

  if (isActive) {
    const { error: deactivateError } = await dataSupabase
      .from("t_academic_year")
      .update({ is_active: false })
      .neq("academic_year", academicYear);

    if (deactivateError) {
      redirect(`/administrator/settings?error=${encodeURIComponent(deactivateError.message)}`);
    }
  }

  const { error } = await dataSupabase
    .from("t_academic_year")
    .update({ is_active: isActive })
    .eq("academic_year", academicYear);

  if (error) {
    redirect(`/administrator/settings?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/administrator/settings?success=academic-year");
}

export async function updateAcademicYearInputOptions(formData: FormData) {
  await requireFullAdminUser();
  const dataSupabase = createSupabaseServiceRoleClient();
  const academicYears = formData.getAll("academic_years").map((value) => String(value).trim()).filter(Boolean);

  const { data: validYears } = await dataSupabase
    .from("t_academic_year")
    .select("academic_year")
    .in("academic_year", academicYears.length ? academicYears : ["__none__"]);
  const validYearSet = new Set((validYears ?? []).map((year) => year.academic_year));
  const selectedYears = academicYears.filter((year) => validYearSet.has(year));

  const { error } = await dataSupabase.from("t_app_setting").upsert(
    {
      setting_key: "student_input_academic_years",
      setting_value: { academic_years: selectedYears },
    },
    { onConflict: "setting_key" },
  );

  if (error) {
    redirect(`/administrator/settings?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/administrator/settings?success=academic-year-input");
}
