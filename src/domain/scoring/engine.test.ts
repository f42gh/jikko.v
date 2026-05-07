import { describe, expect, it } from "vitest";
import { rankTasks, scoreTask } from "./engine";
import type { Task } from "../tasks/types";

const baseTask: Task = {
  id: "task",
  title: "Important task",
  status: "orient",
  parentTaskId: null,
  observeMemo: "",
  orientMemo: "",
  roiScore: 5,
  estimatedMinutes: 30,
  actStartedAt: null,
  actDueAt: null,
  progressNote: "",
  createdAt: "2026-05-07T00:00:00.000Z",
  updatedAt: "2026-05-07T00:00:00.000Z",
};

describe("scoreTask", () => {
  it("produces a positive priority for a high-value task", () => {
    const recommendation = scoreTask(baseTask);

    expect(recommendation.priorityScore).toBeGreaterThan(5);
    expect(recommendation.expectedRoi).toBeGreaterThan(2);
    expect(recommendation.whyNowSummary).toContain("ROI");
  });

  it("ranks only orient tasks", () => {
    const ranked = rankTasks([
      baseTask,
      {
        ...baseTask,
        id: "observe-task",
        status: "observe",
      },
    ]);

    expect(ranked).toHaveLength(1);
    expect(ranked[0]?.task.id).toBe("task");
  });
});
