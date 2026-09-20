import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

const execFileAsync = promisify(execFile);

// Integration tests are the only thing allowed to read .env.test.local —
// unit tests must never depend on it being present (see "Estratégia de
// testes" in PLAN.md). Since this module is only ever imported by
// integration test files, loading it here (as an import side effect) keeps
// that boundary without needing a global Vitest setupFile.
function loadTestEnv(): void {
  const envPath = path.join(process.cwd(), ".env.test.local");
  let content: string;

  try {
    content = readFileSync(envPath, "utf8");
  } catch {
    throw new Error(
      `missing_test_env_file: ${envPath} not found. Integration tests need a dedicated Supabase dev project — see PLAN.md Etapa 4.`,
    );
  }

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadTestEnv();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`missing_test_env: ${name} is required in .env.test.local`);
  }
  return value;
}

interface TestProjectConfig {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
  ref: string;
}

// Refuses to run against anything but the explicit dev project pinned in
// .env.test.local — this is the guard that keeps integration tests from
// ever accidentally hitting production once one exists (Etapa 18).
function assertAllowedTestProject(): TestProjectConfig {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const allowedRef = requireEnv("SUPABASE_TEST_PROJECT_REF");

  const actualRef = new URL(url).host.split(".")[0];
  if (actualRef !== allowedRef) {
    throw new Error(
      `refusing_to_run_integration_tests: project ref "${actualRef}" (from NEXT_PUBLIC_SUPABASE_URL) does not match the allowed SUPABASE_TEST_PROJECT_REF "${allowedRef}".`,
    );
  }

  return { url, anonKey, serviceRoleKey, ref: actualRef };
}

// Service-role client: bypasses RLS entirely. Only the test harness may use
// this — application code always goes through an authenticated user client.
export function adminClient(): SupabaseClient<Database> {
  const { url, serviceRoleKey } = assertAllowedTestProject();
  return createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function anonClient(): SupabaseClient<Database> {
  const { url, anonKey } = assertAllowedTestProject();
  return createClient<Database>(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export interface TestUser {
  id: string;
  email: string;
  client: SupabaseClient<Database>;
}

let fixtureCounter = 0;

// Creates a real confirmed user via the admin API and signs in for real
// (signInWithPassword) to get an authenticated client subject to RLS — per
// PLAN.md, RLS must be proven with genuine sessions, never admin queries.
export async function createTestUser(): Promise<TestUser> {
  const admin = adminClient();
  fixtureCounter += 1;
  const email = `fixture-etapa6-${Date.now()}-${fixtureCounter}@example.com`;
  const password = `Aa1!${Math.random().toString(36).slice(2)}`;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(`failed_to_create_test_user: ${error?.message}`);
  }

  const client = anonClient();
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) {
    throw new Error(`failed_to_sign_in_test_user: ${signInError.message}`);
  }

  return { id: data.user.id, email, client };
}

// Deletes the user; ON DELETE CASCADE takes their contents/review_logs with it.
export async function deleteTestUser(userId: string): Promise<void> {
  const admin = adminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw new Error(`failed_to_delete_test_user: ${error.message}`);
}

export async function createTestContent(
  user: TestUser,
  overrides: Partial<{
    title: string;
    intervalIndex: number;
    nextReviewDate: string | null;
    status: "active" | "mastered" | "archived";
  }> = {},
) {
  const { data, error } = await user.client
    .from("contents")
    .insert({
      title: overrides.title ?? "Fixture content",
      interval_index: overrides.intervalIndex ?? 0,
      next_review_date: overrides.nextReviewDate === undefined ? todayPlusOneUtcDateString() : overrides.nextReviewDate,
      status: overrides.status ?? "active",
      user_id: user.id,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`failed_to_create_test_content: ${error?.message}`);
  }
  return data;
}

function todayPlusOneUtcDateString(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// Moves a review_logs row's reviewed_at into the past (admin-only: RLS has
// no update policy for review_logs by design, so this bypasses it on
// purpose). Used to simulate a multi-day review cycle without waiting real
// days — see "Fixtures de tempo e testes do ciclo" in PLAN.md. Sao Paulo has
// been a fixed UTC-3 offset since 2019 (no DST), so "noon there" is always
// 15:00 UTC.
export async function backdateReviewLog(logId: string, daysAgo: number): Promise<void> {
  const admin = adminClient();
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  const reviewedAt = `${d.toISOString().slice(0, 10)}T15:00:00.000Z`;

  const { error } = await admin.from("review_logs").update({ reviewed_at: reviewedAt }).eq("id", logId);
  if (error) throw new Error(`failed_to_backdate_review_log: ${error.message}`);
}

// Runs raw admin SQL via the Supabase CLI's Management API connection
// (`supabase db query --linked`) — the only way to run DDL (e.g. a
// temporary trigger for the rollback test) without a stored direct Postgres
// password. Double-checks the CLI's own linked project against the same
// allow-listed ref before running anything.
export async function runAdminSql(sql: string): Promise<void> {
  const { ref } = assertAllowedTestProject();

  const refFile = path.join(process.cwd(), "supabase", ".temp", "project-ref");
  let linkedRef: string;
  try {
    linkedRef = readFileSync(refFile, "utf8").trim();
  } catch {
    throw new Error(`refusing_admin_sql: could not read ${refFile} — run "supabase link" first.`);
  }
  if (linkedRef !== ref) {
    throw new Error(`refusing_admin_sql: CLI is linked to "${linkedRef}", expected "${ref}".`);
  }

  await execFileAsync("npx", ["supabase", "db", "query", "--linked", sql], {
    cwd: process.cwd(),
    maxBuffer: 10 * 1024 * 1024,
  });
}
