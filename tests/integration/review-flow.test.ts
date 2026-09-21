import { afterEach, describe, expect, it } from "vitest";
import { computeNextReview, isLastInterval } from "@/lib/review";
import { todaySaoPaulo } from "@/lib/date";
import {
  adminClient,
  backdateReviewLog,
  createTestContent,
  createTestUser,
  deleteTestUser,
  runAdminSql,
  type TestUser,
} from "../helpers/fixtures";

describe("mark_content_reviewed RPC", () => {
  const createdUserIds: string[] = [];

  afterEach(async () => {
    for (const id of createdUserIds.splice(0)) {
      await deleteTestUser(id);
    }
  });

  async function freshUser(): Promise<TestUser> {
    const user = await createTestUser();
    createdUserIds.push(user.id);
    return user;
  }

  it("walks the full 5-review cycle to mastery, matching lib/review.ts", async () => {
    const user = await freshUser();
    const content = await createTestContent(user, { intervalIndex: 0 });
    const today = todaySaoPaulo();

    for (let step = 1; step <= 4; step += 1) {
      const { data, error } = await user.client.rpc("mark_content_reviewed", {
        p_content_id: content.id,
      });

      expect(error).toBeNull();
      expect(data?.interval_index).toBe(step);
      expect(data?.status).toBe("active");
      expect(data?.next_review_date).toBe(computeNextReview(step, today));
      expect(data?.last_reviewed_at).toBe(today);

      const { data: logs } = await user.client
        .from("review_logs")
        .select("id, reviewed_at")
        .eq("content_id", content.id)
        .order("reviewed_at", { ascending: false })
        .limit(1);
      expect(logs).toHaveLength(1);

      const { count } = await user.client
        .from("review_logs")
        .select("id", { count: "exact", head: true })
        .eq("content_id", content.id);
      expect(count).toBe(step);

      // Free up "today" for the next call and keep log order ascending —
      // see "Fixtures de tempo e testes do ciclo" in PLAN.md.
      await backdateReviewLog(logs![0].id, 6 - step);
    }

    const { data: fifth, error: fifthError } = await user.client.rpc("mark_content_reviewed", {
      p_content_id: content.id,
    });
    expect(fifthError).toBeNull();
    expect(fifth?.status).toBe("mastered");
    expect(fifth?.interval_index).toBe(4);
    expect(fifth?.next_review_date).toBeNull();
    expect(fifth?.last_reviewed_at).toBe(today);
    expect(isLastInterval(4)).toBe(true);

    const { count: totalLogs } = await user.client
      .from("review_logs")
      .select("id", { count: "exact", head: true })
      .eq("content_id", content.id);
    expect(totalLogs).toBe(5);
  });

  it("allows an early review, before next_review_date arrives", async () => {
    const user = await freshUser();
    const farFuture = new Date();
    farFuture.setUTCDate(farFuture.getUTCDate() + 30);
    const content = await createTestContent(user, {
      intervalIndex: 0,
      nextReviewDate: farFuture.toISOString().slice(0, 10),
    });

    const { data, error } = await user.client.rpc("mark_content_reviewed", {
      p_content_id: content.id,
    });

    expect(error).toBeNull();
    expect(data?.interval_index).toBe(1);
  });

  it.each(["mastered", "archived"] as const)(
    "rejects marking a %s content as reviewed",
    async (status) => {
      const user = await freshUser();
      const content = await createTestContent(user, {
        intervalIndex: 4,
        status,
        nextReviewDate: null,
      });

      const { data, error } = await user.client.rpc("mark_content_reviewed", {
        p_content_id: content.id,
      });

      expect(data).toBeNull();
      expect(error?.message).toContain("content_not_active");
    },
  );

  it("only one of two concurrent reviews advances an active content (indices 0-3)", async () => {
    const user = await freshUser();
    const content = await createTestContent(user, { intervalIndex: 1 });

    const results = await Promise.all([
      user.client.rpc("mark_content_reviewed", { p_content_id: content.id }),
      user.client.rpc("mark_content_reviewed", { p_content_id: content.id }),
    ]);

    const successes = results.filter((r) => !r.error);
    const failures = results.filter((r) => r.error);

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    expect(failures[0].error?.message).toContain("already_reviewed_today");
    expect(successes[0].data?.interval_index).toBe(2);

    const { count } = await user.client
      .from("review_logs")
      .select("id", { count: "exact", head: true })
      .eq("content_id", content.id);
    expect(count).toBe(1);
  });

  it("at the last interval, one concurrent call masters it and the other is rejected as inactive", async () => {
    const user = await freshUser();
    const content = await createTestContent(user, { intervalIndex: 4 });

    const results = await Promise.all([
      user.client.rpc("mark_content_reviewed", { p_content_id: content.id }),
      user.client.rpc("mark_content_reviewed", { p_content_id: content.id }),
    ]);

    const successes = results.filter((r) => !r.error);
    const failures = results.filter((r) => r.error);

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    expect(successes[0].data?.status).toBe("mastered");
    // Unlike indices 0-3: the loser sees status already flipped to
    // 'mastered' and fails the *status* check, never reaching the
    // same-day duplicate check.
    expect(failures[0].error?.message).toContain("content_not_active");
  });

  it("rolls back the log insert if the content update fails (atomicity)", async () => {
    const user = await freshUser();
    const content = await createTestContent(user, { intervalIndex: 0 });

    // Idempotent on purpose: a previous run that was killed mid-test (e.g.
    // by a timeout) could leave this trigger behind, since a hard abort
    // skips the `finally` cleanup below.
    await runAdminSql(`drop trigger if exists _test_block_content_update_trigger on contents;`);
    await runAdminSql(`
      create or replace function _test_block_content_update()
      returns trigger
      language plpgsql
      as $$
      begin
        if OLD.id = '${content.id}' then
          raise exception 'test_induced_rollback_failure';
        end if;
        return NEW;
      end;
      $$;
    `);
    await runAdminSql(`
      create trigger _test_block_content_update_trigger
      before update on contents
      for each row
      execute function _test_block_content_update();
    `);

    try {
      const { data, error } = await user.client.rpc("mark_content_reviewed", {
        p_content_id: content.id,
      });
      expect(data).toBeNull();
      expect(error?.message).toContain("test_induced_rollback_failure");
    } finally {
      await runAdminSql(`drop trigger if exists _test_block_content_update_trigger on contents;`);
      await runAdminSql(`drop function if exists _test_block_content_update();`);
    }

    const admin = adminClient();
    const { data: unchanged } = await admin
      .from("contents")
      .select("*")
      .eq("id", content.id)
      .single();
    expect(unchanged?.interval_index).toBe(0);
    expect(unchanged?.status).toBe("active");

    const { count } = await admin
      .from("review_logs")
      .select("id", { count: "exact", head: true })
      .eq("content_id", content.id);
    expect(count).toBe(0);

    // Confirm the trigger is really gone and the RPC works normally again.
    const { data: retried, error: retriedError } = await user.client.rpc("mark_content_reviewed", {
      p_content_id: content.id,
    });
    expect(retriedError).toBeNull();
    expect(retried?.interval_index).toBe(1);
  });

  it("blocks a second same-day review_log insert via the unique index, bypassing the RPC", async () => {
    const user = await freshUser();
    const content = await createTestContent(user, { intervalIndex: 0 });

    const first = await user.client
      .from("review_logs")
      .insert({ content_id: content.id, user_id: user.id, interval_index_at_review: 0 });
    expect(first.error).toBeNull();

    const second = await user.client
      .from("review_logs")
      .insert({ content_id: content.id, user_id: user.id, interval_index_at_review: 0 });
    expect(second.error).not.toBeNull();
    expect(second.error?.message).toMatch(/duplicate key|unique/i);
  });
});
