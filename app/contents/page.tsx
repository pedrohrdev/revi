import type { Metadata } from "next";
import Link from "next/link";
import { cn } from "cn";
import { SearchIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getAllContents, type ContentRow } from "@/lib/data/contents";
import { formatRelativeDayPtBR, formatShortDatePtBR, todaySaoPaulo } from "@/lib/date";
import { PageContainer, PageHeader } from "@/components/page-header";
import { ReviewProgress } from "@/components/review-progress";
import { SubjectTag } from "@/components/subject-tag";

export const metadata: Metadata = { title: "Conteúdos" };

const STATUS_TABS = [
  { value: "active", label: "Em revisão" },
  { value: "mastered", label: "Dominados" },
  { value: "archived", label: "Arquivados" },
  { value: "all", label: "Todos" },
] as const;

type StatusFilter = (typeof STATUS_TABS)[number]["value"];

function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR");
}

function hrefWith(
  current: { q: string; s: string; status: StatusFilter },
  patch: Partial<{ q: string; s: string; status: StatusFilter }>,
): string {
  const next = { ...current, ...patch };
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.s) params.set("s", next.s);
  if (next.status !== "active") params.set("status", next.status);
  const query = params.toString();
  return query ? `/contents?${query}` : "/contents";
}

function nextLabel(content: ContentRow, today: string): { text: string; tone: "late" | "today" | "normal" } {
  if (content.status === "mastered") return { text: "Ciclo completo", tone: "normal" };
  if (content.status === "archived") return { text: "Arquivado", tone: "normal" };
  if (!content.next_review_date) return { text: "—", tone: "normal" };
  if (content.next_review_date < today) {
    return { text: `Atrasada desde ${formatShortDatePtBR(content.next_review_date)}`, tone: "late" };
  }
  if (content.next_review_date === today) return { text: "Hoje", tone: "today" };
  return {
    text: `${formatShortDatePtBR(content.next_review_date)}, ${formatRelativeDayPtBR(content.next_review_date, today)}`,
    tone: "normal",
  };
}

export default async function ContentsPage(props: PageProps<"/contents">) {
  const params = await props.searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const s = typeof params.s === "string" ? params.s : "";
  const statusParam = typeof params.status === "string" ? params.status : "active";
  const status: StatusFilter = STATUS_TABS.some((tab) => tab.value === statusParam)
    ? (statusParam as StatusFilter)
    : "active";
  const current = { q, s, status };

  const supabase = await createClient();
  const all = await getAllContents(supabase);
  const today = todaySaoPaulo();

  const subjects = [
    ...new Set(all.map((content) => content.subject?.trim()).filter((x): x is string => !!x)),
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));

  const countByStatus = (value: StatusFilter) =>
    value === "all" ? all.length : all.filter((content) => content.status === value).length;

  const needle = normalize(q);
  const filtered = all
    .filter((content) => status === "all" || content.status === status)
    .filter((content) => !s || (s === "-" ? !content.subject?.trim() : content.subject?.trim() === s))
    .filter(
      (content) =>
        !needle ||
        normalize(`${content.title} ${content.subject ?? ""} ${content.notes ?? ""}`).includes(needle),
    )
    .sort((a, b) => {
      if (status === "active") {
        return (a.next_review_date ?? "").localeCompare(b.next_review_date ?? "");
      }
      return b.studied_at.localeCompare(a.studied_at);
    });

  return (
    <PageContainer>
      <PageHeader
        title="Conteúdos"
        description="Tudo o que você já estudou, onde cada assunto está no ciclo de revisões e quando volta."
      />

      <div className="space-y-4">
        <form action="/contents" className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Buscar por assunto, matéria ou anotação"
            aria-label="Buscar conteúdos"
            className="h-11 w-full rounded-xl border border-border bg-card pr-4 pl-10 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
          />
          {s ? <input type="hidden" name="s" value={s} /> : null}
          {status !== "active" ? <input type="hidden" name="status" value={status} /> : null}
        </form>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="Filtrar por situação" className="flex gap-1 overflow-x-auto">
            {STATUS_TABS.map((tab) => (
              <Link
                key={tab.value}
                href={hrefWith(current, { status: tab.value })}
                aria-current={status === tab.value ? "page" : undefined}
                className={cn(
                  "shrink-0 rounded-lg px-3 py-1.5 text-sm transition-colors",
                  status === tab.value
                    ? "bg-secondary font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label} <span className="text-muted-foreground tabular">{countByStatus(tab.value)}</span>
              </Link>
            ))}
          </nav>
        </div>

        {subjects.length > 0 ? (
          <nav aria-label="Filtrar por matéria" className="flex flex-wrap gap-1.5">
            <Link
              href={hrefWith(current, { s: "" })}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                !s ? "border-foreground/40 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              Todas as matérias
            </Link>
            {subjects.map((subject) => (
              <Link
                key={subject}
                href={hrefWith(current, { s: s === subject ? "" : subject })}
                aria-current={s === subject ? "true" : undefined}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  s === subject ? "border-foreground/40 text-foreground" : "border-border hover:border-foreground/20",
                )}
              >
                <SubjectTag subject={subject} className={s === subject ? "text-foreground" : ""} />
              </Link>
            ))}
          </nav>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="text-sm text-muted-foreground">
            {all.length === 0
              ? "Nenhum conteúdo ainda. Use “Registrar estudo” para começar."
              : q || s
                ? "Nada encontrado com esses filtros."
                : "Nenhum conteúdo nesta situação."}
          </p>
          {q || s ? (
            <Link href={hrefWith(current, { q: "", s: "" })} className="mt-3 inline-block text-sm text-primary hover:underline">
              Limpar filtros
            </Link>
          ) : null}
        </div>
      ) : (
        <div>
          <div className="hidden grid-cols-[minmax(0,1fr)_150px_130px_190px] gap-6 border-b border-border pb-2 text-xs text-muted-foreground md:grid">
            <span>Assunto</span>
            <span>Progresso</span>
            <span>Estudado em</span>
            <span>Próxima revisão</span>
          </div>
          <ul className="divide-y divide-border border-b border-border">
            {filtered.map((content) => {
              const next = nextLabel(content, today);
              return (
                <li key={content.id} className="relative">
                  <Link
                    href={`/contents/${content.id}`}
                    className="absolute inset-0 z-0 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={content.title}
                  />
                  <div className="pointer-events-none relative grid gap-2 py-4 transition-colors md:grid-cols-[minmax(0,1fr)_150px_130px_190px] md:items-center md:gap-6">
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-medium">{content.title}</p>
                      <SubjectTag subject={content.subject} className="text-xs" />
                    </div>
                    <div className="pointer-events-auto relative z-10 w-fit">
                      <ReviewProgress
                        intervalIndex={content.interval_index}
                        status={content.status}
                        nextReviewDate={content.next_review_date}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground md:text-sm">
                      <span className="md:hidden">Estudado em </span>
                      {formatShortDatePtBR(content.studied_at)}
                    </span>
                    <span
                      className={cn(
                        "text-xs md:text-sm",
                        next.tone === "late" && "font-medium text-overdue",
                        next.tone === "today" && "font-medium text-primary",
                        next.tone === "normal" && "text-muted-foreground",
                      )}
                    >
                      {next.text}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </PageContainer>
  );
}
