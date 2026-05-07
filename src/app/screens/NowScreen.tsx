import { useEffect, useState } from "react";
import { useTaskStore } from "../../state/task-store";

export function NowScreen() {
  const recommendation = useTaskStore((state) => state.recommendation);
  const decideNextTask = useTaskStore((state) => state.decideNextTask);
  const startAct = useTaskStore((state) => state.startAct);
  const completeAct = useTaskStore((state) => state.completeAct);
  const timeoutAct = useTaskStore((state) => state.timeoutAct);
  const [nowMs, setNowMs] = useState(Date.now());
  const [progressNote, setProgressNote] = useState(recommendation?.task.progressNote ?? "");
  const [estimatedMinutes, setEstimatedMinutes] = useState(recommendation?.task.estimatedMinutes ?? 25);
  const [orientMemo, setOrientMemo] = useState(recommendation?.task.orientMemo ?? "");

  useEffect(() => {
    setProgressNote(recommendation?.task.progressNote ?? "");
    setEstimatedMinutes(recommendation?.task.estimatedMinutes ?? 25);
    setOrientMemo(recommendation?.task.orientMemo ?? "");
  }, [recommendation?.task.id, recommendation?.task.progressNote, recommendation?.task.estimatedMinutes, recommendation?.task.orientMemo]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!recommendation || recommendation.task.status !== "act" || !recommendation.task.actDueAt) {
      return;
    }

    if (new Date(recommendation.task.actDueAt).getTime() > nowMs) {
      return;
    }

    void timeoutAct(recommendation.task.id, {
      roiScore: recommendation.task.roiScore ?? 3,
      estimatedMinutes: estimatedMinutes || recommendation.task.estimatedMinutes || 25,
      orientMemo,
      progressNote: progressNote || "時間で区切って戻します。",
    });
  }, [estimatedMinutes, nowMs, orientMemo, progressNote, recommendation, timeoutAct]);

  if (!recommendation) {
    return (
      <div className="rounded-3xl border border-dashed border-white/20 bg-white/[0.06] p-10 backdrop-blur-xl">
        <p className="font-display text-3xl">空</p>
      </div>
    );
  }

  const task = recommendation.task;
  const isActiveAct = task.status === "act";
  const dueState = describeDueState(task.actDueAt, nowMs);

  const handleDecideAndStart = async () => {
    const decided = await decideNextTask();
    if (decided) {
      await startAct(decided.task.id);
    }
  };

  const handleTimeout = async () => {
    if (!isActiveAct) {
      return;
    }

    await timeoutAct(task.id, {
      roiScore: task.roiScore ?? 3,
      estimatedMinutes,
      orientMemo,
      progressNote,
    });
  };

  return (
    <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(176,228,204,0.06),transparent_42%),rgba(255,255,255,0.03)] px-5 py-5 text-ink shadow-card backdrop-blur-xl md:px-8 md:py-7">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="rounded-[1.8rem] border border-accent/24 bg-[linear-gradient(180deg,rgba(176,228,204,0.1),rgba(255,255,255,0.02))] px-6 py-6">
          <div className="flex items-center justify-between gap-4 text-xs tracking-[0.18em] text-white/30">
            <span>{isActiveAct ? "ACT" : "READY"}</span>
            <span>{dueState.label}</span>
          </div>
          <h2 className="mt-6 font-display text-[clamp(3rem,7vw,5.5rem)] leading-[0.92] text-ink">{task.title}</h2>
          <div className="mt-5 flex gap-3 text-sm text-white/46">
            <span>ROI {task.roiScore ?? "-"}</span>
            <span>{task.estimatedMinutes ?? "-"}m</span>
          </div>
        </div>

        <div className="rounded-[1.6rem] border border-white/10 bg-black/22 px-5 py-5 shadow-card backdrop-blur-xl">
          <textarea
            className="min-h-28 w-full rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-sm text-ink outline-none transition focus:border-accent/60"
            onChange={(event) => setProgressNote(event.target.value)}
            placeholder="メモ"
            value={progressNote}
          />
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
            <input
              className="w-full rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-ink outline-none transition focus:border-accent/60"
              min={1}
              onChange={(event) => setEstimatedMinutes(Number(event.target.value))}
              step={5}
              type="number"
              value={estimatedMinutes}
            />
            <div className="flex flex-wrap gap-3">
              {isActiveAct ? (
                <>
                  <button
                    className="rounded-full border border-accent/35 bg-accent/10 px-5 py-3 text-sm font-semibold text-accent outline-none transition hover:bg-accent/15 focus-visible:ring-1 focus-visible:ring-accent/45"
                    onClick={() => void completeAct(task.id)}
                    type="button"
                  >
                    完了
                  </button>
                  <button
                    className="rounded-full border border-white/20 px-5 py-3 text-sm font-semibold text-ink outline-none transition hover:border-accent/45 hover:bg-accent/10 focus-visible:ring-1 focus-visible:ring-accent/45"
                    onClick={() => void handleTimeout()}
                    type="button"
                  >
                    戻す
                  </button>
                </>
              ) : (
                <button
                  className="rounded-full border border-accent/35 bg-accent/10 px-5 py-3 text-sm font-semibold text-accent outline-none transition hover:bg-accent/15 focus-visible:ring-1 focus-visible:ring-accent/45"
                  onClick={() => void handleDecideAndStart()}
                  type="button"
                >
                  開始
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function describeDueState(actDueAt: string | null, nowMs: number) {
  if (!actDueAt) {
    return { label: "" };
  }

  const remainingMs = new Date(actDueAt).getTime() - nowMs;
  if (remainingMs <= 0) {
    return { label: "00:00" };
  }

  const minutes = Math.floor(remainingMs / 60000);
  const seconds = Math.floor((remainingMs % 60000) / 1000);
  return {
    label: `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`,
  };
}
