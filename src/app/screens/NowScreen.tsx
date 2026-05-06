import { useTaskStore } from "../../state/task-store";

export function NowScreen() {
  const recommendation = useTaskStore((state) => state.recommendation);
  const completeTask = useTaskStore((state) => state.completeTask);
  const startTask = useTaskStore((state) => state.startTask);
  const rankedTasks = useTaskStore((state) => state.rankedTasks);
  const inProgressCount = useTaskStore(
    (state) => state.tasks.filter((task) => task.status === "in_progress").length,
  );

  if (!recommendation) {
    return (
      <div className="rounded-3xl border border-dashed border-white/20 bg-white/[0.06] p-10 backdrop-blur-xl">
        <p className="font-display text-3xl">未選択</p>
      </div>
    );
  }

  const { task } = recommendation;
  const activeStageIndex = task.status === "in_progress" ? 3 : 2;
  const previousStages = oodaStages.slice(0, activeStageIndex);
  const currentStage = oodaStages[activeStageIndex];
  const nextStage = oodaStages[activeStageIndex + 1] ?? null;

  return (
    <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(176,228,204,0.08),transparent_42%),rgba(255,255,255,0.04)] px-5 py-5 text-ink shadow-card backdrop-blur-xl md:px-8 md:py-7">
      <div className="flex min-h-[calc(100vh-11rem)] flex-col justify-between gap-6">
        <div className="flex items-center justify-between gap-4">
          <p className="text-[11px] tracking-[0.28em] text-white/26">OODA timeline</p>
          <div className="text-[11px] tracking-[0.22em] text-white/24">{statusLabel(task.status)}</div>
        </div>

        <div className="flex-1">
          <div className="relative mx-auto flex h-full max-w-6xl flex-col justify-center">
            <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-black/18 px-3 py-4 md:px-5 md:py-5">
              <div className="pointer-events-none absolute left-6 right-6 top-[4.4rem] hidden h-px bg-white/10 md:block" />
              <div className="pointer-events-none absolute left-6 right-6 top-[4.4rem] hidden md:flex md:justify-between">
                {tickOffsets.map((offset) => (
                  <span
                    className={`block w-px ${offset.major ? "h-4 -translate-y-2 bg-white/18" : "h-2 -translate-y-1 bg-white/10"}`}
                    key={offset.id}
                  />
                ))}
              </div>
              <div className="pointer-events-none absolute left-6 right-6 top-[3.2rem] hidden md:grid md:grid-cols-4">
                {oodaStages.map((stage) => (
                  <div className="text-center text-[10px] tracking-[0.22em] text-white/18" key={stage.id + stage.label}>
                    {stage.label}
                  </div>
                ))}
              </div>
              <div className="pointer-events-none absolute left-1/2 top-5 hidden h-[calc(100%-2.5rem)] w-[min(38vw,26rem)] -translate-x-1/2 rounded-[1.9rem] border border-accent/28 bg-accent/[0.03] shadow-[0_0_36px_rgba(176,228,204,0.06)] md:block" />
              <div className="pointer-events-none absolute left-[calc(50%-12rem)] top-8 hidden h-[calc(100%-4rem)] w-px bg-accent/18 md:block" />
              <div className="pointer-events-none absolute left-[calc(50%+12rem)] top-8 hidden h-[calc(100%-4rem)] w-px bg-accent/18 md:block" />

              <div className="grid gap-3 pt-10 md:grid-cols-[0.72fr_minmax(18rem,1.36fr)_0.72fr] md:items-center md:pt-14">
                <div className="hidden space-y-2 md:block">
                  {previousStages.map((stage, index) => (
                    <OodaIsland
                      key={stage.id}
                      stage={stage}
                      state={index === previousStages.length - 1 ? "recent" : "past"}
                    />
                  ))}
                </div>

                <div className="relative z-10 rounded-[1.9rem] border border-accent/28 bg-[linear-gradient(180deg,rgba(176,228,204,0.14),rgba(255,255,255,0.03))] px-5 py-5 text-center shadow-card backdrop-blur-xl md:px-8 md:py-7">
                  <div className="flex items-center justify-between text-[10px] tracking-[0.22em] text-white/28">
                    <span>cursor</span>
                    <span>{currentStage.label}</span>
                  </div>
                  <h2 className="mt-10 font-display text-[clamp(3rem,7vw,6rem)] leading-[0.92] text-ink">
                    {task.title}
                  </h2>
                  <p className="mt-5 text-xs tracking-[0.2em] text-white/28">{currentStage.note}</p>
                </div>

                <div className="hidden space-y-2 md:block">
                  <OodaIsland stage={currentStage} state="active" />
                  {nextStage ? <OodaIsland stage={nextStage} state="next" /> : null}
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap justify-center gap-2 md:hidden">
              <CompactStage stage={currentStage} state="active" />
              {nextStage ? <CompactStage stage={nextStage} state="next" /> : null}
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
          <div className="grid gap-4 md:grid-cols-2">
            <MetricPanel
              label="ROI"
              value={recommendation.expectedRoi.toFixed(2)}
              note="やる価値"
              detail="期待リターン"
            />
            <MetricPanel
              label="優先度"
              value={recommendation.priorityScore.toFixed(2)}
              note="いまやるべき強さ"
              detail="総合判断"
            />
          </div>

          <div className="grid gap-3 xl:min-w-[16rem]">
            <div className="flex flex-wrap gap-2 text-[11px] text-white/28 xl:justify-end">
              <span className="rounded-full border border-white/10 px-3 py-1">候補 {rankedTasks.length} 件</span>
              <span className="rounded-full border border-white/10 px-3 py-1">進行中 {inProgressCount} 件</span>
            </div>
            <div className="flex flex-wrap gap-3 xl:justify-end">
              <button
                className="rounded-full border border-accent/35 bg-accent/10 px-5 py-3 text-sm font-semibold text-accent outline-none transition hover:bg-accent/15 focus-visible:ring-1 focus-visible:ring-accent/45"
                onClick={() => startTask(task.id)}
                type="button"
              >
                始める
              </button>
              <button
                className="rounded-full border border-white/20 px-5 py-3 text-sm font-semibold text-ink outline-none transition hover:border-accent/45 hover:bg-accent/10 focus-visible:ring-1 focus-visible:ring-accent/45"
                onClick={() => completeTask(task.id)}
                type="button"
              >
                完了にする
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

type MetricPanelProps = {
  label: string;
  value: string;
  note: string;
  detail: string;
};

function MetricPanel({ label, value, note, detail }: MetricPanelProps) {
  const parts = splitMetricValue(value);

  return (
    <div className="rounded-[1.8rem] border border-white/10 bg-black/22 px-5 py-5 shadow-card backdrop-blur-xl md:px-6 md:py-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] tracking-[0.22em] text-white/28">{label}</p>
          <p className="mt-1 text-sm text-white/34">{note}</p>
        </div>
        <p className="text-[11px] tracking-[0.18em] text-white/20">{detail}</p>
      </div>

      <div className="mt-5 grid min-h-[6.5rem] grid-cols-[minmax(0,1fr)_auto] items-end gap-3 border-t border-white/8 pt-4">
        <div className="min-w-0 overflow-hidden">
          <div className="flex min-w-0 items-end justify-end gap-1 font-display leading-none text-ink">
            <span className="metric-whole min-w-0 truncate">{parts.whole}</span>
            {parts.fraction ? <span className="metric-fraction">.{parts.fraction}</span> : null}
          </div>
        </div>
        <div className="pb-2 text-[10px] tracking-[0.22em] text-white/22">readout</div>
      </div>
    </div>
  );
}

function splitMetricValue(value: string) {
  const [whole, fraction] = value.split(".");
  return {
    whole,
    fraction: fraction ?? "",
  };
}

function OodaIsland({
  stage,
  state,
}: {
  stage: (typeof oodaStages)[number];
  state: "past" | "recent" | "active" | "next";
}) {
  const tone =
    state === "active"
      ? "border-accent/30 bg-accent/8"
      : state === "recent"
        ? "border-white/10 bg-white/[0.04]"
        : state === "next"
          ? "border-white/8 bg-white/[0.03]"
          : "border-white/6 bg-white/[0.02]";

  return (
    <div className={`rounded-[1.45rem] border px-4 py-3 transition ${tone}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.22em] text-white/22">{stage.id}</p>
        <span className="rounded-full bg-black/20 px-2 py-1 text-[10px] tracking-[0.18em] text-white/22">
          {stateLabel(state)}
        </span>
      </div>
      <p className="mt-4 text-sm font-semibold text-ink">{stage.label}</p>
      <p className="mt-1 text-[11px] leading-5 text-white/30">{stage.note}</p>
    </div>
  );
}

function CompactStage({
  stage,
  state,
}: {
  stage: (typeof oodaStages)[number];
  state: "active" | "next";
}) {
  return (
    <div className={`rounded-full border px-3 py-2 text-xs ${state === "active" ? "border-accent/35 bg-accent/10 text-ink" : "border-white/10 bg-white/[0.04] text-white/58"}`}>
      {stage.label}
    </div>
  );
}

function stateLabel(state: "past" | "recent" | "active" | "next") {
  switch (state) {
    case "active":
      return "現在";
    case "recent":
      return "直前";
    case "next":
      return "次";
    default:
      return "通過";
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "in_progress":
      return "act";
    case "done":
      return "done";
    default:
      return "decide";
  }
}

const oodaStages = [
  {
    id: "O",
    label: "観測",
    note: "候補と状況を見つめる",
  },
  {
    id: "O",
    label: "文脈化",
    note: "重みと指数で文脈をそろえる",
  },
  {
    id: "D",
    label: "決定",
    note: "いま実行する 1 件へ絞る",
  },
  {
    id: "A",
    label: "実行",
    note: "着手して完了まで進める",
  },
] as const;

const tickOffsets = [
  { id: "t1", major: true },
  { id: "t2", major: false },
  { id: "t3", major: false },
  { id: "t4", major: true },
  { id: "t5", major: false },
  { id: "t6", major: false },
  { id: "t7", major: true },
  { id: "t8", major: false },
  { id: "t9", major: false },
  { id: "t10", major: true },
  { id: "t11", major: false },
  { id: "t12", major: false },
  { id: "t13", major: true },
] as const;
