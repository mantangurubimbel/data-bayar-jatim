import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "..");

dotenv.config({ path: resolve(projectRoot, ".env.local") });
dotenv.config({ path: resolve(projectRoot, ".env") });

const email = process.argv[2]?.trim().toLowerCase();
const password = process.argv[3]?.trim();

if (!email || !password) {
  console.error("Usage: npm run check:login -- email@example.com password");
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !anonKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, anonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const { data, error } = await supabase.auth.signInWithPassword({
  email,
  password,
});

if (error) {
  console.error(`Login failed: ${error.message}`);
  process.exit(1);
}

console.log(`Login ok: ${data.user.email} (${data.user.id})`);
