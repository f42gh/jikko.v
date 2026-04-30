import { useTaskStore } from "../../state/task-store";

export function PlanScreen() {
  const rankedTasks = useTaskStore((state) => state.rankedTasks);

  return (
    <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-card">
      <p className="text-xs uppercase tracking-[0.3em] text-black/45">Ranked plan</p>
      <div className="mt-5 space-y-4">
        {rankedTasks.map((recommendation, index) => (
          <article
            className="rounded-2xl border border-black/10 bg-paper p-4"
            key={recommendation.task.id}
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-black/45">
                  Rank {index + 1}
                </p>
                <h3 className="mt-1 text-xl font-semibold">{recommendation.task.title}</h3>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-black/65">
                  {recommendation.whyNowSummary}
                </p>
              </div>
              <div className="rounded-2xl bg-white px-4 py-3 text-right">
                <p className="text-xs uppercase tracking-[0.2em] text-black/45">Priority</p>
                <p className="mt-1 text-3xl font-semibold">
                  {recommendation.priorityScore.toFixed(2)}
                </p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
