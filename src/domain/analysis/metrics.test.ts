import { describe, expect, it } from "vitest";
import { buildAnalysisMetrics } from "./metrics";
import { buildAnalysisSuggestions } from "./suggestions";
import type { Recommendation, ScoreWeights } from "../scoring/types";
import type { Task } from "../tasks/types";
import type { TaskEvent } from "../../infra/db/types";

const weights: ScoreWeights = {
  roi: 1.4,
  effortPenalty: 0.8,
};

const tasks: Task[] = [
  {
    id: "done-task",
    title: "終わったタスク",
    status: "done",
    parentTaskId: null,
    observeMemo: "",
    orientMemo: "",
    roiScore: 4,
    estimatedMinutes: 20,
    actStartedAt: "2026-05-06T09:00:00.000Z",
    actDueAt: null,
    progressNote: "",
    createdAt: "2026-05-06T08:30:00.000Z",
    updatedAt: "2026-05-06T09:28:00.000Z",
  },
  {
    id: "child-task",
    title: "子タスク",
    status: "observe",
    parentTaskId: "parent-task",
    observeMemo: "",
    orientMemo: "",
    roiScore: null,
    estimatedMinutes: null,
    actStartedAt: null,
    actDueAt: null,
    progressNote: "",
    createdAt: "2026-05-06T10:00:00.000Z",
    updatedAt: "2026-05-06T10:00:00.000Z",
  },
];

const rankedTasks: Recommendation[] = [
  {
    task: {
      ...tasks[0],
      id: "orient-task",
      status: "orient",
      title: "候補タスク",
    },
    priorityScore: 5.2,
    expectedRoi: 3.4,
    whyNowSummary: "ROI 5.6 / Cost 1.6",
    breakdown: {
      roi: 5.6,
      effortPenalty: 1.6,
    },
  },
];

const events: TaskEvent[] = [
  {
    id: "started",
    taskId: "done-task",
    eventType: "act_started",
    payloadJson: "{\"estimatedMinutes\":20}",
    createdAt: "2026-05-06T09:00:00.000Z",
  },
  {
    id: "timed-out",
    taskId: "done-task",
    eventType: "act_timed_out",
    payloadJson: "{\"estimatedMinutes\":20}",
    createdAt: "2026-05-06T09:20:00.000Z",
  },
  {
    id: "reoriented",
    taskId: "done-task",
    eventType: "reoriented",
    payloadJson: "{\"roiScore\":4}",
    createdAt: "2026-05-06T09:24:00.000Z",
  },
  {
    id: "completed",
    taskId: "done-task",
    eventType: "completed",
    payloadJson: "{\"actualMinutes\":28}",
    createdAt: "2026-05-06T09:28:00.000Z",
  },
  {
    id: "decomposed",
    taskId: "parent-task",
    eventType: "decomposed",
    payloadJson: "{\"childTaskId\":\"child-task\"}",
    createdAt: "2026-05-06T08:10:00.000Z",
  },
];

describe("buildAnalysisMetrics", () => {
  it("aggregates summary, series, and flow metrics", () => {
    const metrics = buildAnalysisMetrics(events, rankedTasks, tasks);

    expect(metrics.summary.completedCount).toBe(1);
    expect(metrics.summary.timeoutCount).toBe(1);
    expect(metrics.summary.decompositionCompletionRate).toBe(0);
    expect(metrics.summary.averageMinutesGap).toBe(8);
    expect(metrics.roiSeries).toHaveLength(7);
    expect(metrics.effortSeries.some((point) => point.actual > 0)).toBe(true);
    expect(metrics.flowSeries.some((point) => point.timedOut > 0)).toBe(true);
  });

  it("builds deterministic suggestions from metrics", () => {
    const metrics = buildAnalysisMetrics(events, rankedTasks, tasks);
    const suggestions = buildAnalysisSuggestions(metrics, weights);

    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.some((item) => item.kind === "weight")).toBe(true);
  });
});
