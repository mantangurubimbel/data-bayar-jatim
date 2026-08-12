import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "..");

dotenv.config({ path: resolve(projectRoot, ".env.local") });
dotenv.config({ path: resolve(projectRoot, ".env") });

const filePath = process.argv[2];

if (!filePath) {
  console.error("Usage: npm run import:users -- /path/to/users.csv");
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function findAuthUserByEmail(email) {
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

    if (error) {
      throw error;
    }

    const authUser = data.users.find((existingUser) => existingUser.email?.toLowerCase() === email);

    if (authUser || data.users.length < 1000) {
      return authUser;
    }

    page += 1;
  }
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      value += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(value.trim());
      value = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        i += 1;
      }
      row.push(value.trim());
      value = "";
      if (row.some((cell) => cell.length > 0)) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    value += char;
  }

  row.push(value.trim());
  if (row.some((cell) => cell.length > 0)) {
    rows.push(row);
  }

  const [headers, ...dataRows] = rows;
  return dataRows.map((dataRow) =>
    Object.fromEntries(headers.map((header, index) => [header, dataRow[index] ?? ""])),
  );
}

function parseBranchIds(value) {
  return value
    .split(/[;,]/)
    .map((branchId) => branchId.trim())
    .filter(Boolean)
    .map((branchId) => Number(branchId));
}

const csvText = await readFile(filePath, "utf8");
const users = parseCsv(csvText);

for (const user of users) {
  const email = user.email?.trim().toLowerCase();
  const password = user.password?.trim();
  const name = user.name?.trim() || null;
  const position = user.position?.trim() || null;
  const roleId = user.role_id?.trim() || "viewer";
  const branchIds = parseBranchIds(user.branch_ids || user.branch_id || "");

  if (!email || !password) {
    console.warn(`Skipped row without email/password: ${JSON.stringify(user)}`);
    continue;
  }

  const { data: authData, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  let authUser = authData.user;

  if (createError && createError.message !== "A user with this email address has already been registered") {
    console.error(`Failed to create auth user ${email}: ${createError.message}`);
    continue;
  }

  if (!authUser) {
    try {
      authUser = await findAuthUserByEmail(email);
    } catch (listError) {
      console.error(`Failed to find existing auth user ${email}: ${listError.message}`);
      continue;
    }
  }

  if (!authUser) {
    console.error(`Auth user not found after create/list: ${email}`);
    continue;
  }

  const { error: updatePasswordError } = await supabase.auth.admin.updateUserById(authUser.id, {
    password,
    email_confirm: true,
  });

  if (updatePasswordError) {
    console.error(`Failed to update password ${email}: ${updatePasswordError.message}`);
    continue;
  }

  const { error: profileError } = await supabase.from("t_app_user").upsert({
    id: authUser.id,
    name,
    email,
    position,
    role_id: roleId,
  });

  if (profileError) {
    console.error(`Failed to upsert profile ${email}: ${profileError.message}`);
    continue;
  }

  if (branchIds.length > 0) {
    const { error: branchError } = await supabase.from("t_app_user_branch").upsert(
      branchIds.map((branchId) => ({
        user_id: authUser.id,
        branch_id: branchId,
      })),
      { onConflict: "user_id,branch_id" },
    );

    if (branchError) {
      console.error(`Failed to upsert branches ${email}: ${branchError.message}`);
      continue;
    }
  }

  console.log(`Imported ${email} (${authUser.id}); password reset; branches: ${branchIds.join(", ") || "-"}`);
}
