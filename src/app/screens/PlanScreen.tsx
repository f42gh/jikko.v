import { useState } from "react";
import { useTaskStore } from "../../state/task-store";
import type { Task } from "../../domain/tasks/types";

export function PlanScreen() {
  const tasks = useTaskStore((state) => state.tasks);
  const orientableTasks = tasks.filter((task) => task.status === "observe" || task.status === "orient");

  return (
    <div className="space-y-3">
      {orientableTasks.map((task) => (
        <OrientCard key={task.id} task={task} />
      ))}
      {orientableTasks.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/12 px-6 py-10 text-center text-sm text-white/40">
          何もありません。
        </div>
      ) : null}
    </div>
  );
}

function OrientCard({ task }: { task: Task }) {
  const orientTask = useTaskStore((state) => state.orientTask);
  const decideNextTask = useTaskStore((state) => state.decideNextTask);
  const startAct = useTaskStore((state) => state.startAct);
  const [roiScore, setRoiScore] = useState(task.roiScore ?? 3);
  const [estimatedMinutes, setEstimatedMinutes] = useState(task.estimatedMinutes ?? 25);
  const [orientMemo, setOrientMemo] = useState(task.orientMemo);

  const decideAndStart = async () => {
    await orientTask(task.id, {
      roiScore,
      estimatedMinutes,
      orientMemo,
    });
    const decided = await decideNextTask();
    if (decided) {
      await startAct(decided.task.id);
    }
  };

  return (
    <article className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-card backdrop-blur-xl">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-xl font-semibold text-ink">{task.title}</h3>
          {task.observeMemo ? <p className="mt-2 text-sm leading-6 text-white/48">{task.observeMemo}</p> : null}
        </div>
        <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-white/38">
          {task.status === "observe" ? "Observe" : "Orient"}
        </span>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="mb-2 block text-sm font-medium">ROI</span>
          <input
            className="w-full rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-ink outline-none transition focus:border-accent/60"
            max={5}
            min={1}
            onChange={(event) => setRoiScore(Number(event.target.value))}
            step={1}
            type="number"
            value={roiScore}
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-medium">Time</span>
          <input
            className="w-full rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-ink outline-none transition focus:border-accent/60"
            min={1}
            onChange={(event) => setEstimatedMinutes(Number(event.target.value))}
            step={5}
            type="number"
            value={estimatedMinutes}
          />
        </label>
      </div>

      <label className="mt-4 block">
        <textarea
          className="min-h-24 w-full rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-ink outline-none transition focus:border-accent/60"
          onChange={(event) => setOrientMemo(event.target.value)}
          placeholder="メモ"
          value={orientMemo}
        />
      </label>

      <div className="mt-5 flex gap-3">
        <button
          className="rounded-full border border-accent/35 bg-accent/10 px-5 py-3 text-sm font-semibold text-accent outline-none transition hover:bg-accent/15 focus-visible:ring-1 focus-visible:ring-accent/45"
          onClick={() => void decideAndStart()}
          type="button"
        >
          進める
        </button>
      </div>
    </article>
  );
}
