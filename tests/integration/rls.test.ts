import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminClient,
  createTestContent,
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "../helpers/fixtures";

// Proves isolation with two REAL authenticated sessions, never admin
// queries — per PLAN.md: "Nunca usar apenas consultas administrativas para
// comprovar RLS."
describe("RLS isolation between users", () => {
  let userA: TestUser;
  let userB: TestUser;
  let contentA: { id: string };
  let logAId: string;

  beforeAll(async () => {
    userA = await createTestUser();
    userB = await createTestUser();
    contentA = await createTestContent(userA, { title: "Conteúdo do usuário A" });

    const admin = adminClient();
    const { data, error } = await admin
      .from("review_logs")
      .insert({ content_id: contentA.id, user_id: userA.id, interval_index_at_review: 0 })
      .select()
      .single();
    if (error || !data) throw new Error(`fixture setup failed: ${error?.message}`);
    logAId = data.id;
  });

  afterAll(async () => {
    await deleteTestUser(userA.id);
    await deleteTestUser(userB.id);
  });

  it("user B cannot select user A's content", async () => {
    const { data } = await userB.client.from("contents").select("*").eq("id", contentA.id);
    expect(data).toEqual([]);
  });

  it("user B cannot update user A's content", async () => {
    const { data, error } = await userB.client
      .from("contents")
      .update({ title: "hijacked" })
      .eq("id", contentA.id)
      .select();

    expect(error).toBeNull();
    expect(data).toEqual([]);

    const admin = adminClient();
    const { data: stillA } = await admin.from("contents").select("title").eq("id", contentA.id).single();
    expect(stillA?.title).toBe("Conteúdo do usuário A");
  });

  it("user B cannot delete user A's content", async () => {
    const { data, error } = await userB.client.from("contents").delete().eq("id", contentA.id).select();

    expect(error).toBeNull();
    expect(data).toEqual([]);

    const admin = adminClient();
    const { data: stillThere } = await admin.from("contents").select("id").eq("id", contentA.id).maybeSingle();
    expect(stillThere).not.toBeNull();
  });

  it("user B cannot read user A's review_logs", async () => {
    const { data } = await userB.client.from("review_logs").select("*").eq("content_id", contentA.id);
    expect(data).toEqual([]);
  });

  it("user B cannot insert a review_log pointing at user A's content", async () => {
    const { error } = await userB.client
      .from("review_logs")
      .insert({ content_id: contentA.id, user_id: userB.id, interval_index_at_review: 0 });

    expect(error).not.toBeNull();
  });

  it("user A can still read their own content and log", async () => {
    const { data: content } = await userA.client.from("contents").select("*").eq("id", contentA.id).single();
    expect(content?.title).toBe("Conteúdo do usuário A");

    const { data: logs } = await userA.client.from("review_logs").select("id").eq("id", logAId);
    expect(logs).toHaveLength(1);
  });
});
