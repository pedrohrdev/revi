// Subconteúdos: the smaller concepts inside a content (req.params,
// req.query, req.body inside "Requisições no Express"). They have no
// schedule, status or history of their own — see PLAN.md Etapa 24. Pure, no
// I/O: the Server Actions run every list through here, and the
// `subtopics_valid` CHECK in 0004_content_subtopics.sql repeats the limits
// as defense in depth.

export const MAX_SUBTOPICS = 20;
export const MAX_SUBTOPIC_LENGTH = 120;

export type SubtopicsError = "too_many_subtopics" | "subtopic_too_long";

export type NormalizeSubtopicsResult =
  | { ok: true; subtopics: string[] }
  | { ok: false; error: SubtopicsError };

const WHITESPACE_RUN = /\s+/g;
const DIACRITICS = /\p{Diacritic}/gu;

// Trims and collapses internal whitespace runs into one space.
export function cleanSubtopic(raw: string): string {
  return raw.replace(WHITESPACE_RUN, " ").trim();
}

// Two subtopics are "the same" when they only differ in case or accents:
// "Cálculo de offset" and "calculo de OFFSET" collapse into one.
export function subtopicKey(subtopic: string): string {
  return cleanSubtopic(subtopic).normalize("NFD").replace(DIACRITICS, "").toLocaleLowerCase("pt-BR");
}

// Cleans, drops blanks, and dedupes keeping the first occurrence in its
// original position; only then enforces the limits, so blank rows and
// duplicates never count toward them. Server Action arguments are
// untrusted, so anything that isn't an array is treated as an empty list
// and non-string entries are skipped.
export function normalizeSubtopics(input: unknown): NormalizeSubtopicsResult {
  const seen = new Set<string>();
  const subtopics: string[] = [];

  for (const raw of Array.isArray(input) ? input : []) {
    if (typeof raw !== "string") continue;
    const subtopic = cleanSubtopic(raw);
    if (!subtopic) continue;

    const key = subtopicKey(subtopic);
    if (seen.has(key)) continue;
    seen.add(key);

    if (subtopic.length > MAX_SUBTOPIC_LENGTH) return { ok: false, error: "subtopic_too_long" };
    subtopics.push(subtopic);
  }

  if (subtopics.length > MAX_SUBTOPICS) return { ok: false, error: "too_many_subtopics" };
  return { ok: true, subtopics };
}
