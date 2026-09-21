"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { computeNextReview } from "@/lib/review";
import { isFutureSaoPaulo, todaySaoPaulo } from "@/lib/date";
import type { Database } from "@/lib/database.types";

export type ActionError =
  | "not_authenticated"
  | "invalid_id"
  | "title_required"
  | "studied_at_invalid"
  | "studied_at_future"
  | "create_failed"
  | "content_not_active"
  | "already_reviewed_today"
  | "content_not_found_or_not_owned"
  | "mark_reviewed_failed"
  | "not_found_or_not_active"
  | "archive_failed"
  | "not_found"
  | "reset_failed"
  | "update_failed"
  | "delete_failed";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: ActionError };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ServerClient = Awaited<ReturnType<typeof createClient>>;

// Defense in depth: proxy.ts and RLS already keep an unauthenticated caller
// from reaching this far in the real app, but every action re-checks anyway.
async function requireUserId(supabase: ServerClient): Promise<string | null> {
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) return null;
  return data.claims.sub;
}

export interface CreateContentInput {
  title: string;
  subject?: string | null;
  notes?: string | null;
  studiedAt: string;
}

export async function createContent(
  input: CreateContentInput,
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const userId = await requireUserId(supabase);
  if (!userId) return { ok: false, error: "not_authenticated" };

  const title = input.title.trim();
  if (!title) return { ok: false, error: "title_required" };

  let isFuture: boolean;
  try {
    isFuture = isFutureSaoPaulo(input.studiedAt);
  } catch {
    return { ok: false, error: "studied_at_invalid" };
  }
  if (isFuture) return { ok: false, error: "studied_at_future" };

  const insertPayload: Database["public"]["Tables"]["contents"]["Insert"] = {
    title,
    subject: input.subject?.trim() || null,
    notes: input.notes?.trim() || null,
    studied_at: input.studiedAt,
    interval_index: 0,
    next_review_date: computeNextReview(0, input.studiedAt),
    status: "active",
    user_id: userId,
  };

  const { data, error } = await supabase
    .from("contents")
    .insert(insertPayload)
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: "create_failed" };

  revalidatePath("/");
  revalidatePath("/contents");
  return { ok: true, data: { id: data.id } };
}

export async function markReviewed(
  contentId: string,
): Promise<ActionResult<{ status: string }>> {
  if (!UUID_PATTERN.test(contentId)) return { ok: false, error: "invalid_id" };

  const supabase = await createClient();
  const userId = await requireUserId(supabase);
  if (!userId) return { ok: false, error: "not_authenticated" };

  const { data, error } = await supabase.rpc("mark_content_reviewed", {
    p_content_id: contentId,
  });

  if (error) {
    const message = error.message ?? "";
    if (message.includes("content_not_active")) return { ok: false, error: "content_not_active" };
    if (message.includes("already_reviewed_today")) {
      return { ok: false, error: "already_reviewed_today" };
    }
    if (message.includes("content_not_found_or_not_owned")) {
      return { ok: false, error: "content_not_found_or_not_owned" };
    }
    return { ok: false, error: "mark_reviewed_failed" };
  }

  revalidatePath("/");
  revalidatePath("/contents");
  revalidatePath(`/contents/${contentId}`);
  return { ok: true, data: { status: data?.status ?? "active" } };
}

export async function archiveContent(contentId: string): Promise<ActionResult> {
  if (!UUID_PATTERN.test(contentId)) return { ok: false, error: "invalid_id" };

  const supabase = await createClient();
  const userId = await requireUserId(supabase);
  if (!userId) return { ok: false, error: "not_authenticated" };

  // Single UPDATE filtered on id + status=active — checking state and
  // writing in one statement avoids a race with a concurrent review/reset.
  const { data, error } = await supabase
    .from("contents")
    .update({ status: "archived" })
    .eq("id", contentId)
    .eq("status", "active")
    .select("id");

  if (error) return { ok: false, error: "archive_failed" };
  if (!data || data.length === 0) return { ok: false, error: "not_found_or_not_active" };

  revalidatePath("/");
  revalidatePath("/contents");
  revalidatePath(`/contents/${contentId}`);
  return { ok: true, data: undefined };
}

export async function resetContent(contentId: string): Promise<ActionResult> {
  if (!UUID_PATTERN.test(contentId)) return { ok: false, error: "invalid_id" };

  const supabase = await createClient();
  const userId = await requireUserId(supabase);
  if (!userId) return { ok: false, error: "not_authenticated" };

  const today = todaySaoPaulo();

  // Reset applies from any status — RLS's owner-only update policy is what
  // keeps this from touching anyone else's content.
  const { data, error } = await supabase
    .from("contents")
    .update({
      interval_index: 0,
      studied_at: today,
      next_review_date: computeNextReview(0, today),
      status: "active",
    })
    .eq("id", contentId)
    .select("id");

  if (error) return { ok: false, error: "reset_failed" };
  if (!data || data.length === 0) return { ok: false, error: "not_found" };

  revalidatePath("/");
  revalidatePath("/contents");
  revalidatePath(`/contents/${contentId}`);
  return { ok: true, data: undefined };
}

export interface UpdateContentInput {
  title: string;
  subject?: string | null;
  notes?: string | null;
}

export async function updateContent(
  contentId: string,
  input: UpdateContentInput,
): Promise<ActionResult> {
  if (!UUID_PATTERN.test(contentId)) return { ok: false, error: "invalid_id" };

  const title = input.title.trim();
  if (!title) return { ok: false, error: "title_required" };

  const supabase = await createClient();
  const userId = await requireUserId(supabase);
  if (!userId) return { ok: false, error: "not_authenticated" };

  const { data, error } = await supabase
    .from("contents")
    .update({
      title,
      subject: input.subject?.trim() || null,
      notes: input.notes?.trim() || null,
    })
    .eq("id", contentId)
    .select("id");

  if (error) return { ok: false, error: "update_failed" };
  if (!data || data.length === 0) return { ok: false, error: "not_found" };

  revalidatePath("/");
  revalidatePath("/contents");
  revalidatePath(`/contents/${contentId}`);
  return { ok: true, data: undefined };
}

export async function deleteContent(contentId: string): Promise<ActionResult> {
  if (!UUID_PATTERN.test(contentId)) return { ok: false, error: "invalid_id" };

  const supabase = await createClient();
  const userId = await requireUserId(supabase);
  if (!userId) return { ok: false, error: "not_authenticated" };

  // Deletion applies from any status. review_logs.content_id has ON DELETE
  // CASCADE, so its history is removed with the content — permanently,
  // unlike archive.
  const { data, error } = await supabase.from("contents").delete().eq("id", contentId).select("id");

  if (error) return { ok: false, error: "delete_failed" };
  if (!data || data.length === 0) return { ok: false, error: "not_found" };

  revalidatePath("/");
  revalidatePath("/contents");
  return { ok: true, data: undefined };
}
