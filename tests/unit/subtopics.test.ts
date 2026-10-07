import { describe, expect, it } from "vitest";
import {
  MAX_SUBTOPICS,
  MAX_SUBTOPIC_LENGTH,
  normalizeSubtopics,
  subtopicKey,
} from "@/lib/subtopics";

function ok(input: unknown): string[] {
  const result = normalizeSubtopics(input);
  if (!result.ok) throw new Error(`expected ok, got ${result.error}`);
  return result.subtopics;
}

describe("normalizeSubtopics", () => {
  it("returns an empty list for no input", () => {
    expect(ok([])).toEqual([]);
  });

  it("trims each item", () => {
    expect(ok(["  req.params ", "\treq.query\n"])).toEqual(["req.params", "req.query"]);
  });

  it("collapses repeated internal whitespace", () => {
    expect(ok(["cálculo   de \t offset"])).toEqual(["cálculo de offset"]);
  });

  it("drops empty and whitespace-only items", () => {
    expect(ok(["", "   ", "page", "\n"])).toEqual(["page"]);
  });

  it("ignores non-string entries", () => {
    expect(ok([null, 42, "limit", undefined])).toEqual(["limit"]);
  });

  it("treats a non-array input as an empty list", () => {
    expect(ok("req.params")).toEqual([]);
    expect(ok(null)).toEqual([]);
  });

  it("drops exact duplicates", () => {
    expect(ok(["page", "limit", "page"])).toEqual(["page", "limit"]);
  });

  it("treats items differing only in case as duplicates", () => {
    expect(ok(["req.params", "REQ.PARAMS", "Req.Params"])).toEqual(["req.params"]);
  });

  it("treats items differing only in accents as duplicates", () => {
    expect(ok(["Cálculo de offset", "calculo de offset", "CALCULO DE OFFSÉT"])).toEqual([
      "Cálculo de offset",
    ]);
  });

  it("treats items differing only in whitespace as duplicates", () => {
    expect(ok(["query parameters", "  query   parameters "])).toEqual(["query parameters"]);
  });

  it("keeps the first occurrence and the original order", () => {
    expect(ok(["skip", "page", "Skip", "limit", "PAGE", "offset"])).toEqual([
      "skip",
      "page",
      "limit",
      "offset",
    ]);
  });

  it(`accepts exactly ${MAX_SUBTOPICS} items`, () => {
    const items = Array.from({ length: MAX_SUBTOPICS }, (_, i) => `item ${i}`);
    expect(ok(items)).toEqual(items);
  });

  it(`rejects more than ${MAX_SUBTOPICS} items`, () => {
    const items = Array.from({ length: MAX_SUBTOPICS + 1 }, (_, i) => `item ${i}`);
    expect(normalizeSubtopics(items)).toEqual({ ok: false, error: "too_many_subtopics" });
  });

  it("does not count blanks or duplicates toward the item limit", () => {
    const items = Array.from({ length: MAX_SUBTOPICS }, (_, i) => `item ${i}`);
    expect(ok([...items, "", "ITEM 0", "  "])).toEqual(items);
  });

  it(`accepts an item of exactly ${MAX_SUBTOPIC_LENGTH} characters`, () => {
    const item = "a".repeat(MAX_SUBTOPIC_LENGTH);
    expect(ok([item])).toEqual([item]);
  });

  it(`rejects an item longer than ${MAX_SUBTOPIC_LENGTH} characters`, () => {
    expect(normalizeSubtopics(["a".repeat(MAX_SUBTOPIC_LENGTH + 1)])).toEqual({
      ok: false,
      error: "subtopic_too_long",
    });
  });

  it("measures length after trimming", () => {
    const item = "a".repeat(MAX_SUBTOPIC_LENGTH);
    expect(ok([`   ${item}   `])).toEqual([item]);
  });
});

describe("subtopicKey", () => {
  it("ignores case, accents and surrounding/repeated whitespace", () => {
    expect(subtopicKey("  Cálculo  de OFFSET ")).toBe(subtopicKey("calculo de offset"));
  });

  it("keeps genuinely different items apart", () => {
    expect(subtopicKey("req.params")).not.toBe(subtopicKey("req.query"));
  });
});
