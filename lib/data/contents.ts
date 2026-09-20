import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { todaySaoPaulo } from "@/lib/date";

type Client = SupabaseClient<Database>;

export type ContentRow = Database["public"]["Tables"]["contents"]["Row"];
export type ReviewLogRow = Database["public"]["Tables"]["review_logs"]["Row"];
export type ContentStatus = "active" | "mastered" | "archived";

// "Para revisar hoje": active contents whose next review is today or
// already overdue. RLS scopes every query here to the caller's own rows —
// no explicit user_id filter needed.
export async function getDueToday(client: Client): Promise<ContentRow[]> {
  const { data, error } = await client
    .from("contents")
    .select("*")
    .eq("status", "active")
    .lte("next_review_date", todaySaoPaulo())
    .order("next_review_date", { ascending: true });

  if (error) throw new Error(`failed_to_get_due_today: ${error.message}`);
  return data;
}

export async function getAllByStatus(
  client: Client,
  status: ContentStatus,
): Promise<ContentRow[]> {
  const { data, error } = await client
    .from("contents")
    .select("*")
    .eq("status", status)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`failed_to_get_contents_by_status: ${error.message}`);
  return data;
}

export async function getContentById(client: Client, id: string): Promise<ContentRow | null> {
  const { data, error } = await client.from("contents").select("*").eq("id", id).maybeSingle();

  if (error) throw new Error(`failed_to_get_content_by_id: ${error.message}`);
  return data;
}

export async function getReviewLogs(client: Client, contentId: string): Promise<ReviewLogRow[]> {
  const { data, error } = await client
    .from("review_logs")
    .select("*")
    .eq("content_id", contentId)
    .order("reviewed_at", { ascending: true });

  if (error) throw new Error(`failed_to_get_review_logs: ${error.message}`);
  return data;
}
