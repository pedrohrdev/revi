import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { addDaysToDateString, todaySaoPaulo } from "@/lib/date";
import { computeNextReview } from "@/lib/review";
import {
  adminClient,
  anonClient,
  backdateReviewLog,
  createTestContent,
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "../helpers/fixtures";

// Per "Testes de Server Actions" in PLAN.md: mock only the Next.js
// boundaries (the client factory and revalidatePath). The Supabase client
// underneath is always real, so this exercises actual business logic, auth,
// and RLS — never queries/RPC/session responses.
let activeClientFactory: () => SupabaseClient<Database> | Promise<SupabaseClient<Database>>;

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => activeClientFactory(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const { archiveContent, createContent, markReviewed, resetContent, updateContent } = await import(
  "@/app/contents/actions"
);
// vi.mock calls above are hoisted before this file's imports run, so a
// plain top-level `import` would also see the mocked module — the dynamic
// import here is equivalent, just explicit about the ordering.

describe("contents Server Actions", () => {
  const createdUserIds: string[] = [];

  afterEach(async () => {
    for (const id of createdUserIds.splice(0)) {
      await deleteTestUser(id);
    }
  });

  async function freshUser(): Promise<TestUser> {
    const user = await createTestUser();
    createdUserIds.push(user.id);
    activeClientFactory = () => user.client;
    return user;
  }

  describe("createContent", () => {
    it("creates a content with the correct initial next_review_date", async () => {
      const user = await freshUser();
      const today = todaySaoPaulo();

      const result = await createContent({ title: "Cálculo I", studiedAt: today });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const admin = adminClient();
      const { data } = await admin
        .from("contents")
        .select("*")
        .eq("id", result.data.id)
        .single();
      expect(data?.next_review_date).toBe(computeNextReview(0, today));
      expect(data?.user_id).toBe(user.id);
      expect(data?.status).toBe("active");
    });

    it("rejects a future studied_at", async () => {
      await freshUser();
      const tomorrow = addDaysToDateString(todaySaoPaulo(), 1);

      const result = await createContent({ title: "Futuro", studiedAt: tomorrow });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe("studied_at_future");
    });

    it("rejects a blank/whitespace title and persists nothing", async () => {
      await freshUser();

      const result = await createContent({ title: "   ", studiedAt: todaySaoPaulo() });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe("title_required");

      const admin = adminClient();
      const { count } = await admin
        .from("contents")
        .select("id", { count: "exact", head: true })
        .eq("title", "   ");
      expect(count).toBe(0);
    });

    it("is rejected for a client with no session, and persists nothing", async () => {
      activeClientFactory = () => anonClient();

      const result = await createContent({ title: "Sem sessão", studiedAt: todaySaoPaulo() });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe("not_authenticated");

      const admin = adminClient();
      const { count } = await admin
        .from("contents")
        .select("id", { count: "exact", head: true })
        .eq("title", "Sem sessão");
      expect(count).toBe(0);
    });
  });

  describe("markReviewed", () => {
    it("walks the full cycle to mastered, matching lib/review.ts, logging each review", async () => {
      const user = await freshUser();
      const content = await createTestContent(user, { intervalIndex: 0 });
      const today = todaySaoPaulo();
      const admin = adminClient();

      for (let step = 1; step <= 4; step += 1) {
        const result = await markReviewed(content.id);
        expect(result.ok).toBe(true);

        const { data: row } = await admin
          .from("contents")
          .select("*")
          .eq("id", content.id)
          .single();
        expect(row?.interval_index).toBe(step);
        expect(row?.next_review_date).toBe(computeNextReview(step, today));

        const { data: logs } = await admin
          .from("review_logs")
          .select("id")
          .eq("content_id", content.id)
          .order("reviewed_at", { ascending: false })
          .limit(1);
        await backdateReviewLog(logs![0].id, 6 - step);
      }

      const fifth = await markReviewed(content.id);
      expect(fifth.ok).toBe(true);
      if (fifth.ok) expect(fifth.data.status).toBe("mastered");

      const { data: final } = await admin.from("contents").select("*").eq("id", content.id).single();
      expect(final?.status).toBe("mastered");
      expect(final?.next_review_date).toBeNull();

      const { count } = await admin
        .from("review_logs")
        .select("id", { count: "exact", head: true })
        .eq("content_id", content.id);
      expect(count).toBe(5);
    });

    it("allows an early review, but rejects a second one the same day — even after reset", async () => {
      const user = await freshUser();
      const content = await createTestContent(user, { intervalIndex: 0 });

      const first = await markReviewed(content.id);
      expect(first.ok).toBe(true);

      const second = await markReviewed(content.id);
      expect(second.ok).toBe(false);
      if (second.ok) return;
      expect(second.error).toBe("already_reviewed_today");

      const reset = await resetContent(content.id);
      expect(reset.ok).toBe(true);

      const afterReset = await markReviewed(content.id);
      expect(afterReset.ok).toBe(false);
      if (afterReset.ok) return;
      expect(afterReset.error).toBe("already_reviewed_today");
    });

    it("rejects marking an archived content as reviewed", async () => {
      const user = await freshUser();
      const content = await createTestContent(user, { intervalIndex: 0 });

      const archived = await archiveContent(content.id);
      expect(archived.ok).toBe(true);

      const result = await markReviewed(content.id);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe("content_not_active");
    });

    it("only one of two concurrent reviews advances the content", async () => {
      const user = await freshUser();
      const content = await createTestContent(user, { intervalIndex: 1 });

      const results = await Promise.all([markReviewed(content.id), markReviewed(content.id)]);

      expect(results.filter((r) => r.ok)).toHaveLength(1);
      const failure = results.find((r) => !r.ok);
      expect(failure && !failure.ok ? failure.error : null).toBe("already_reviewed_today");
    });

    it("is rejected for a client with no session", async () => {
      const user = await freshUser();
      const content = await createTestContent(user, { intervalIndex: 0 });

      activeClientFactory = () => anonClient();
      const result = await markReviewed(content.id);

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe("not_authenticated");
    });
  });

  describe("resetContent", () => {
    it("reactivates a mastered content, restarts the cycle, and preserves history", async () => {
      const user = await freshUser();
      const content = await createTestContent(user, {
        intervalIndex: 4,
        status: "mastered",
        nextReviewDate: null,
      });

      const admin = adminClient();
      const { error: seedLogError } = await admin.from("review_logs").insert({
        content_id: content.id,
        user_id: user.id,
        interval_index_at_review: 4,
      });
      expect(seedLogError).toBeNull();

      const result = await resetContent(content.id);
      expect(result.ok).toBe(true);

      const { data: row } = await admin.from("contents").select("*").eq("id", content.id).single();
      expect(row?.status).toBe("active");
      expect(row?.interval_index).toBe(0);
      expect(row?.next_review_date).toBe(computeNextReview(0, todaySaoPaulo()));

      const { count } = await admin
        .from("review_logs")
        .select("id", { count: "exact", head: true })
        .eq("content_id", content.id);
      expect(count).toBe(1);
    });
  });

  describe("updateContent", () => {
    it("rejects a blank title", async () => {
      const user = await freshUser();
      const content = await createTestContent(user, { title: "Original" });

      const result = await updateContent(content.id, { title: "  " });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe("title_required");

      const admin = adminClient();
      const { data } = await admin.from("contents").select("title").eq("id", content.id).single();
      expect(data?.title).toBe("Original");
    });
  });

  describe("cross-user isolation", () => {
    it("user A cannot mark, archive, reset, or edit user B's content", async () => {
      const userA = await freshUser();
      const contentA = await createTestContent(userA, { title: "Pertence a A" });

      await freshUser(); // switches activeClientFactory to a second user, B

      const markResult = await markReviewed(contentA.id);
      expect(markResult.ok).toBe(false);

      const archiveResult = await archiveContent(contentA.id);
      expect(archiveResult.ok).toBe(false);

      const resetResult = await resetContent(contentA.id);
      expect(resetResult.ok).toBe(false);

      const updateResult = await updateContent(contentA.id, { title: "hijacked" });
      expect(updateResult.ok).toBe(false);

      const admin = adminClient();
      const { data } = await admin.from("contents").select("title").eq("id", contentA.id).single();
      expect(data?.title).toBe("Pertence a A");
    });
  });
});
