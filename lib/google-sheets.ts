import { createSign } from "node:crypto";

type StudentSheetRow = {
  nis: string;
  payment_date: string;
  academic_year: string;
  user_serial: string;
  user_name: string;
  user_phone: string;
  birth_date: string | null;
  email: string;
  grade: string | null;
  npsn: string;
  school_name: string | null;
  rombel_name: string | null;
  parents_name: string | null;
  parents_phone: string | null;
  agent_name: string | null;
  payment_method: string | null;
  status: string;
  branch_name: string | null;
  created_at: string;
  operator_email: string | null;
  level: string | null;
};

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

function base64Url(input: string | Buffer) {
  return Buffer.from(input)
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

function getSheetsConfig() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replaceAll("\\n", "\n");
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const tabName = process.env.GOOGLE_SHEET_TAB_NAME;

  if (!clientEmail || !privateKey || !spreadsheetId || !tabName) {
    return null;
  }

  return { clientEmail, privateKey, spreadsheetId, tabName };
}

function tabRange(tabName: string, range: string) {
  return encodeURIComponent(`'${tabName.replaceAll("'", "''")}'!${range}`);
}

function studentSheetValues(row: StudentSheetRow) {
  return [
    row.nis,
    row.payment_date,
    row.academic_year,
    row.user_serial,
    row.user_name,
    row.user_phone,
    row.birth_date ?? "",
    row.email,
    row.grade ?? "",
    row.npsn,
    row.school_name ?? "",
    row.rombel_name ?? "",
    row.parents_name ?? "",
    row.parents_phone ?? "",
    row.agent_name ?? "",
    row.payment_method ?? "",
    row.status,
    row.branch_name ?? "",
    row.created_at,
    row.operator_email ?? "",
    row.level ?? "",
  ];
}

async function getGoogleAccessToken(clientEmail: string, privateKey: string) {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60_000) {
    return cachedAccessToken.token;
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };
  const unsignedToken = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;
  const signature = createSign("RSA-SHA256").update(unsignedToken).sign(privateKey);
  const assertion = `${unsignedToken}.${base64Url(signature)}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!response.ok) {
    throw new Error(`Google auth failed: ${response.status} ${await response.text()}`);
  }

  const result = (await response.json()) as { access_token: string; expires_in: number };
  cachedAccessToken = {
    token: result.access_token,
    expiresAt: Date.now() + result.expires_in * 1000,
  };

  return result.access_token;
}

export async function appendStudentToSheet(row: StudentSheetRow) {
  const config = getSheetsConfig();

  if (!config) {
    return { skipped: true };
  }

  const accessToken = await getGoogleAccessToken(config.clientEmail, config.privateKey);
  const range = encodeURIComponent(`'${config.tabName.replaceAll("'", "''")}'!A:Z`);
  const url = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values/${range}:append`,
  );
  url.searchParams.set("valueInputOption", "USER_ENTERED");
  url.searchParams.set("insertDataOption", "INSERT_ROWS");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      values: [studentSheetValues(row)],
    }),
  });

  if (!response.ok) {
    throw new Error(`Google Sheets append failed: ${response.status} ${await response.text()}`);
  }

  return { skipped: false };
}

export async function upsertStudentToSheet(row: StudentSheetRow) {
  const config = getSheetsConfig();

  if (!config) {
    return { skipped: true };
  }

  const accessToken = await getGoogleAccessToken(config.clientEmail, config.privateKey);
  const lookupUrl = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values/${tabRange(config.tabName, "A:A")}`,
  );
  const lookupResponse = await fetch(lookupUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!lookupResponse.ok) {
    throw new Error(`Google Sheets lookup failed: ${lookupResponse.status} ${await lookupResponse.text()}`);
  }

  const lookupResult = (await lookupResponse.json()) as { values?: string[][] };
  const rowIndex = lookupResult.values?.findIndex((value) => value[0] === row.nis) ?? -1;

  if (rowIndex < 0) {
    return appendStudentToSheet(row);
  }

  const rowNumber = rowIndex + 1;
  const updateUrl = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values/${tabRange(
      config.tabName,
      `A${rowNumber}:U${rowNumber}`,
    )}`,
  );
  updateUrl.searchParams.set("valueInputOption", "USER_ENTERED");

  const updateResponse = await fetch(updateUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values: [studentSheetValues(row)] }),
  });

  if (!updateResponse.ok) {
    throw new Error(`Google Sheets update failed: ${updateResponse.status} ${await updateResponse.text()}`);
  }

  return { skipped: false };
}
