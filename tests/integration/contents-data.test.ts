import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addDaysToDateString, todaySaoPaulo } from "@/lib/date";
import {
  getAllByStatus,
  getContentById,
  getDueToday,
  getReviewLogs,
} from "@/lib/data/contents";
import { createTestContent, createTestUser, deleteTestUser, type TestUser } from "../helpers/fixtures";

describe("lib/data/contents", () => {
  let user: TestUser;

  beforeAll(async () => {
    user = await createTestUser();
  });

  afterAll(async () => {
    await deleteTestUser(user.id);
  });

  describe("getDueToday", () => {
    it("returns only active contents due today or overdue, ordered by next_review_date", async () => {
      const today = todaySaoPaulo();
      const yesterday = addDaysToDateString(today, -1);
      const tomorrow = addDaysToDateString(today, 1);

      const overdue = await createTestContent(user, {
        title: "Vencido ontem",
        nextReviewDate: yesterday,
      });
      const dueToday = await createTestContent(user, {
        title: "Vence hoje",
        nextReviewDate: today,
      });
      await createTestContent(user, {
        title: "Só amanhã",
        nextReviewDate: tomorrow,
      });
      await createTestContent(user, {
        title: "Dominado, ignorar mesmo com data passada",
        status: "mastered",
        intervalIndex: 4,
        nextReviewDate: null,
      });

      const due = await getDueToday(user.client);
      const dueIds = due.map((c) => c.id);

      expect(dueIds).toContain(overdue.id);
      expect(dueIds).toContain(dueToday.id);
      expect(due.every((c) => c.status === "active")).toBe(true);
      expect(due.every((c) => c.next_review_date !== null && c.next_review_date <= today)).toBe(
        true,
      );

      // Ascending by next_review_date: the overdue one comes before today's.
      const overdueIndex = due.findIndex((c) => c.id === overdue.id);
      const dueTodayIndex = due.findIndex((c) => c.id === dueToday.id);
      expect(overdueIndex).toBeLessThan(dueTodayIndex);
    });
  });

  describe("getAllByStatus", () => {
    it("returns only contents matching the requested status", async () => {
      const active = await createTestContent(user, { title: "Ativo para status" });
      const mastered = await createTestContent(user, {
        title: "Dominado para status",
        status: "mastered",
        intervalIndex: 4,
        nextReviewDate: null,
      });
      const archived = await createTestContent(user, {
        title: "Arquivado para status",
        status: "archived",
        nextReviewDate: null,
      });

      const activeResults = await getAllByStatus(user.client, "active");
      const masteredResults = await getAllByStatus(user.client, "mastered");
      const archivedResults = await getAllByStatus(user.client, "archived");

      expect(activeResults.map((c) => c.id)).toContain(active.id);
      expect(activeResults.every((c) => c.status === "active")).toBe(true);

      expect(masteredResults.map((c) => c.id)).toContain(mastered.id);
      expect(masteredResults.every((c) => c.status === "mastered")).toBe(true);

      expect(archivedResults.map((c) => c.id)).toContain(archived.id);
      expect(archivedResults.every((c) => c.status === "archived")).toBe(true);
    });
  });

  describe("getContentById", () => {
    it("returns the matching content", async () => {
      const content = await createTestContent(user, { title: "Buscar por id" });

      const found = await getContentById(user.client, content.id);

      expect(found?.id).toBe(content.id);
      expect(found?.title).toBe("Buscar por id");
    });

    it("returns null for a nonexistent id", async () => {
      const found = await getContentById(user.client, "00000000-0000-0000-0000-000000000000");
      expect(found).toBeNull();
    });
  });

  describe("getReviewLogs", () => {
    it("returns the content's history ordered by reviewed_at ascending", async () => {
      const content = await createTestContent(user, { title: "Com histórico" });
      const today = todaySaoPaulo();

      // Distinct days: the unique index blocks two logs for the same
      // content on the same day (see Etapa 6).
      const older = `${addDaysToDateString(today, -2)}T12:00:00.000Z`;
      const newer = `${addDaysToDateString(today, -1)}T12:00:00.000Z`;

      const { error: insertOlderError } = await user.client.from("review_logs").insert({
        content_id: content.id,
        user_id: user.id,
        interval_index_at_review: 0,
        reviewed_at: older,
      });
      expect(insertOlderError).toBeNull();

      const { error: insertNewerError } = await user.client.from("review_logs").insert({
        content_id: content.id,
        user_id: user.id,
        interval_index_at_review: 1,
        reviewed_at: newer,
      });
      expect(insertNewerError).toBeNull();

      const logs = await getReviewLogs(user.client, content.id);

      expect(logs).toHaveLength(2);
      // Compare as instants, not raw strings — PostgREST may reformat the
      // timestamptz on the way back out.
      expect(new Date(logs[0].reviewed_at).getTime()).toBe(new Date(older).getTime());
      expect(new Date(logs[1].reviewed_at).getTime()).toBe(new Date(newer).getTime());
    });
  });
});
