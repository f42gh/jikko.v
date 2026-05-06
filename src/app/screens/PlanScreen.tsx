import { useTaskStore } from "../../state/task-store";

export function PlanScreen() {
  const rankedTasks = useTaskStore((state) => state.rankedTasks);

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-card backdrop-blur-xl">
      <div className="mb-6">
        <h2 className="font-display text-3xl text-ink">比較して決める</h2>
        <p className="mt-2 text-sm leading-6 text-white/55">
          主役はいまの画面です。ここでは、なぜ次点なのかだけを短く確認します。
        </p>
      </div>
      <div className="space-y-4">
        {rankedTasks.map((recommendation, index) => (
          <article
            className="rounded-2xl border border-white/10 bg-zinc-950/75 p-4"
            key={recommendation.task.id}
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-3xl">
                <p className="text-xs uppercase tracking-[0.2em] text-white/40">
                  {index + 1} 位
                </p>
                <h3 className="mt-1 text-xl font-semibold">{recommendation.task.title}</h3>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-white/60">
                  {recommendation.whyNowSummary}
                </p>
              </div>
              <div className="grid min-w-[18rem] gap-3 sm:grid-cols-2">
                <MetricCard
                  label="ROI"
                  value={recommendation.expectedRoi.toFixed(2)}
                />
                <MetricCard
                  label="優先度"
                  value={recommendation.priorityScore.toFixed(2)}
                />
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-right">
      <p className="text-xs tracking-[0.18em] text-white/40">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-ink">{value}</p>
    </div>
  );
}
