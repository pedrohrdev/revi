import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getAllContents, getAllReviewLogs } from "@/lib/data/contents";
import { formatReviewDatePtBR, formatShortDatePtBR, todaySaoPaulo } from "@/lib/date";
import {
  TOTAL_STAGES,
  activityCounts,
  buildActivity,
  buildHeatmap,
  completedStages,
  computeStreak,
  intensityStep,
} from "@/lib/insights";
import { PageContainer, PageHeader, SectionHeading } from "@/components/page-header";

export const metadata: Metadata = { title: "Progresso" };

const HEAT_FILL = ["bg-stage-0", "bg-stage-2", "bg-stage-3", "bg-stage-4", "bg-stage-5"];

export default async function ProgressPage() {
  const supabase = await createClient();
  const [contents, logs] = await Promise.all([getAllContents(supabase), getAllReviewLogs(supabase)]);
  const today = todaySaoPaulo();

  const activity = buildActivity(contents, logs);
  const counts = activityCounts(activity);
  const streak = computeStreak(new Set(counts.keys()), today);
  const heatmap = buildHeatmap(counts, today, 53);
  const max = Math.max(0, ...heatmap.flat().map((cell) => cell.count));
  const activeDays = heatmap.flat().filter((cell) => cell.count > 0).length;

  const tracked = contents.filter((content) => content.status !== "archived");
  const byStage = Array.from({ length: TOTAL_STAGES + 1 }, (_, stage) => ({
    stage,
    count: tracked.filter((content) => completedStages(content) === stage).length,
  }));
  const maxStage = Math.max(1, ...byStage.map((row) => row.count));
  const mastered = contents.filter((content) => content.status === "mastered").length;

  const tiles = [
    { label: "Dias seguidos", value: streak.current, note: `Recorde de ${streak.best}` },
    { label: "Revisões feitas", value: logs.length, note: "Desde o começo" },
    { label: "Assuntos estudados", value: contents.length, note: `${tracked.length} em acompanhamento` },
    { label: "Dominados", value: mastered, note: "Passaram pelas 5 revisões" },
  ];

  // Month labels above the heatmap, at the first week that starts a month.
  const monthLabels = heatmap.map((week, i) => {
    const first = week[0].date;
    const previous = i > 0 ? heatmap[i - 1][0].date : null;
    return !previous || first.slice(5, 7) !== previous.slice(5, 7)
      ? formatShortDatePtBR(first).split(" ")[1]
      : "";
  });

  return (
    <PageContainer>
      <PageHeader
        title="Progresso"
        description="Sua constância e o quanto do que você estudou já está consolidado."
      />

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border lg:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="bg-background p-5 sm:p-6">
            <dt className="text-sm text-muted-foreground">{tile.label}</dt>
            <dd className="mt-2 font-display text-5xl leading-none tabular">{tile.value}</dd>
            <dd className="mt-2 text-xs text-muted-foreground">{tile.note}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="heat-heading">
        <SectionHeading
          title={<span id="heat-heading">Atividade no último ano</span>}
          aside={`${activeDays} dia${activeDays === 1 ? "" : "s"} com estudo ou revisão`}
        />
        <div className="overflow-x-auto rounded-2xl border border-border p-5">
          <div className="inline-grid gap-1" style={{ gridTemplateColumns: `24px repeat(${heatmap.length}, 15px)` }}>
            <span />
            {monthLabels.map((label, i) => (
              <span key={i} className="h-4 text-[10px] whitespace-nowrap text-muted-foreground">
                {label}
              </span>
            ))}
            {Array.from({ length: 7 }, (_, day) => (
              <Row key={day} day={day} heatmap={heatmap} max={max} />
            ))}
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            Menos
            {HEAT_FILL.map((fill) => (
              <span key={fill} className={`size-3 rounded-[3px] ${fill}`} aria-hidden />
            ))}
            Mais
          </div>
        </div>
      </section>

      <section aria-labelledby="stage-heading">
        <SectionHeading
          title={<span id="stage-heading">Onde seus assuntos estão no ciclo</span>}
          aside="Arquivados não entram"
        />
        <div className="rounded-2xl border border-border p-5">
          {tracked.length === 0 ? (
            <p className="text-sm text-muted-foreground">Registre um estudo para ver seu ciclo aqui.</p>
          ) : (
            <ul className="space-y-3">
              {byStage.map((row) => (
                <li key={row.stage} className="grid grid-cols-[130px_minmax(0,1fr)_32px] items-center gap-4 text-sm">
                  <span className="text-muted-foreground">
                    {row.stage === 0
                      ? "Só estudado"
                      : row.stage === TOTAL_STAGES
                        ? "Dominado"
                        : `${row.stage} revis${row.stage === 1 ? "ão" : "ões"}`}
                  </span>
                  <span className="h-3 rounded-r-[4px]" aria-hidden>
                    <span
                      className="block h-full rounded-r-[4px]"
                      style={{
                        width: `${(row.count / maxStage) * 100}%`,
                        minWidth: row.count > 0 ? 4 : 0,
                        backgroundColor: row.stage === 0 ? "var(--muted-foreground)" : `var(--stage-${row.stage})`,
                      }}
                    />
                  </span>
                  <span className="text-right tabular">{row.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </PageContainer>
  );
}

function Row({
  day,
  heatmap,
  max,
}: {
  day: number;
  heatmap: ReturnType<typeof buildHeatmap>;
  max: number;
}) {
  const labels = ["", "seg", "", "qua", "", "sex", ""];
  return (
    <>
      <span className="text-[10px] leading-[15px] text-muted-foreground">{labels[day]}</span>
      {heatmap.map((week) => {
        const cell = week[day];
        if (cell.future) return <span key={cell.date} />;
        const label = `${formatReviewDatePtBR(cell.date)}: ${cell.count} atividade${cell.count === 1 ? "" : "s"}`;
        return (
          <span
            key={cell.date}
            title={label}
            aria-label={label}
            role="img"
            className={`size-[15px] rounded-[3px] ${HEAT_FILL[intensityStep(cell.count, max)]}`}
          />
        );
      })}
    </>
  );
}
