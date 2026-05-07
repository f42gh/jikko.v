import { describe, expect, it } from "vitest";
import { createObservedTask } from "../domain/tasks/factory";
import {
  applyCompleteActTask,
  applyOrientTask,
  applyStartActTask,
  applyTimeoutActTask,
  deriveTaskState,
} from "./task-store";
import { defaultScoreWeights } from "../domain/scoring/defaults";

describe("task-store transitions", () => {
  it("creates an observe task from the minimal input", () => {
    const task = createObservedTask({
      title: "Observe first",
      observeMemo: "置くだけ",
    });

    expect(task.status).toBe("observe");
    expect(task.observeMemo).toBe("置くだけ");
    expect(task.roiScore).toBeNull();
  });

  it("moves an observed task into orient with scoring fields", () => {
    const observed = createObservedTask({ title: "T", observeMemo: "" });
    const oriented = applyOrientTask(observed, {
      roiScore: 4,
      estimatedMinutes: 30,
      orientMemo: "意味づけ",
    });

    expect(oriented.status).toBe("orient");
    expect(oriented.estimatedMinutes).toBe(30);
  });

  it("sets act timing and returns to orient on timeout", () => {
    const observed = createObservedTask({ title: "T", observeMemo: "" });
    const oriented = applyOrientTask(observed, {
      roiScore: 4,
      estimatedMinutes: 30,
      orientMemo: "意味づけ",
    });
    const active = applyStartActTask(oriented);
    const timedOut = applyTimeoutActTask(active, {
      roiScore: 3,
      estimatedMinutes: 20,
      orientMemo: "分割する",
      progressNote: "半分まで進んだ",
    });

    expect(active.status).toBe("act");
    expect(active.actDueAt).not.toBeNull();
    expect(timedOut.status).toBe("orient");
    expect(timedOut.progressNote).toContain("半分");
  });

  it("completes only from an act-shaped task", () => {
    const observed = createObservedTask({ title: "T", observeMemo: "" });
    const oriented = applyOrientTask(observed, {
      roiScore: 4,
      estimatedMinutes: 15,
      orientMemo: "",
    });
    const active = applyStartActTask(oriented);
    const completed = applyCompleteActTask(active);

    expect(completed.status).toBe("done");
  });

  it("recomputes analysis metrics and suggestions from tasks and events", () => {
    const observed = createObservedTask({ title: "T", observeMemo: "" });
    const oriented = applyOrientTask(observed, {
      roiScore: 4,
      estimatedMinutes: 20,
      orientMemo: "",
    });
    const active = applyStartActTask(oriented);
    const completed = applyCompleteActTask(active);

    const derived = deriveTaskState(
      [completed],
      [
        {
          id: "event-completed",
          taskId: completed.id,
          eventType: "completed",
          payloadJson: "{\"actualMinutes\":26}",
          createdAt: "2026-05-07T09:30:00.000Z",
        },
      ],
      defaultScoreWeights,
    );

    expect(derived.analysisMetrics.summary.completedCount).toBe(1);
    expect(derived.analysisMetrics.effortSeries.some((point) => point.actual > 0)).toBe(true);
    expect(derived.analysisSuggestions.length).toBeGreaterThan(0);
  });
});
