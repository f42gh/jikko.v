import { useTaskStore } from "../../state/task-store";
import { ScoreCard } from "../components/ScoreCard";

export function NowScreen() {
  const recommendation = useTaskStore((state) => state.recommendation);
  const completeTask = useTaskStore((state) => state.completeTask);
  const startTask = useTaskStore((state) => state.startTask);

  if (!recommendation) {
    return (
      <div className="rounded-3xl border border-dashed border-black/20 bg-white/50 p-10">
        <p className="font-display text-3xl">No recommendation yet.</p>
        <p className="mt-3 text-black/65">
          Add tasks in Inbox and give them enough structure for scoring.
        </p>
      </div>
    );
  }

  const { task } = recommendation;

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-black/10 bg-ink px-6 py-8 text-paper shadow-card md:px-8">
        <p className="text-xs uppercase tracking-[0.3em] text-paper/55">Do this now</p>
        <h2 className="mt-4 max-w-3xl font-display text-4xl leading-tight md:text-6xl">
          {task.title}
        </h2>
        <p className="mt-5 max-w-2xl text-base leading-7 text-paper/80">
          {recommendation.whyNowSummary}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <button
            className="rounded-full bg-brass px-5 py-3 text-sm font-semibold text-ink"
            onClick={() => startTask(task.id)}
            type="button"
          >
            Start task
          </button>
          <button
            className="rounded-full border border-paper/20 px-5 py-3 text-sm font-semibold text-paper"
            onClick={() => completeTask(task.id)}
            type="button"
          >
            Complete task
          </button>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <ScoreCard recommendation={recommendation} />
        <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-card">
          <p className="text-xs uppercase tracking-[0.3em] text-black/45">Why this wins</p>
          <ul className="mt-4 space-y-3 text-sm leading-7 text-black/70">
            <li>High expected impact relative to required effort.</li>
            <li>Delay carries a meaningful downstream penalty.</li>
            <li>Completion should increase momentum for the next step.</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
