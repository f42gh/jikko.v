import { defaultScoreWeights } from "./defaults";
import type { Recommendation, ScoreWeights } from "./types";
import type { Task } from "../tasks/types";

export function scoreTask(
  task: Task,
  weights: ScoreWeights = defaultScoreWeights,
): Recommendation {
  const roi = (task.roiScore ?? 1) * weights.roi;
  const effortPenalty = calculateEffortPenalty(task.estimatedMinutes) * weights.effortPenalty;

  const priorityScore = roi - effortPenalty;
  const expectedRoi = roi / Math.max(effortPenalty, 0.5);

  return {
    task,
    priorityScore,
    expectedRoi,
    whyNowSummary: buildWhyNowSummary({ roi, effortPenalty }),
    breakdown: {
      roi,
      effortPenalty,
    },
  };
}

export function rankTasks(
  tasks: Task[],
  weights: ScoreWeights = defaultScoreWeights,
): Recommendation[] {
  return tasks
    .filter(
      (task) =>
        task.status === "orient" &&
        task.roiScore !== null &&
        task.estimatedMinutes !== null,
    )
    .map((task) => scoreTask(task, weights))
    .sort((left, right) => right.priorityScore - left.priorityScore);
}

function calculateEffortPenalty(estimatedMinutes: number | null) {
  if (!estimatedMinutes) {
    return 1;
  }

  return Math.max(1, estimatedMinutes / 25);
}

function buildWhyNowSummary(breakdown: Recommendation["breakdown"]) {
  return `ROI ${breakdown.roi.toFixed(1)} / Cost ${breakdown.effortPenalty.toFixed(1)}`;
}
