import { defaultScoreWeights } from "./defaults";
import type { Recommendation, ScoreWeights } from "./types";
import type { Task } from "../tasks/types";

export function scoreTask(task: Task, weights: ScoreWeights = defaultScoreWeights): Recommendation {
  const breakdown = {
    urgency: task.urgency * weights.urgency,
    impact: task.impact * weights.impact,
    penaltyOfDelay: task.penaltyOfDelay * weights.penaltyOfDelay,
    momentumGain: task.momentumGain * weights.momentumGain,
    effortEstimate: task.effortEstimate * weights.effortEstimate,
    emotionalResistance: task.emotionalResistance * weights.emotionalResistance,
    energyRequired: task.energyRequired * weights.energyRequired,
  };

  const positive =
    breakdown.urgency +
    breakdown.impact +
    breakdown.penaltyOfDelay +
    breakdown.momentumGain;
  const negative =
    breakdown.effortEstimate +
    breakdown.emotionalResistance +
    breakdown.energyRequired;

  const priorityScore = positive - negative;
  const expectedRoi = positive / Math.max(negative, 0.25);

  return {
    task,
    priorityScore,
    expectedRoi,
    whyNowSummary: buildWhyNowSummary(task, priorityScore, expectedRoi),
    breakdown,
  };
}

export function rankTasks(tasks: Task[], weights: ScoreWeights = defaultScoreWeights): Recommendation[] {
  return tasks
    .filter((task) => task.status !== "done")
    .map((task) => scoreTask(task, weights))
    .sort((left, right) => right.priorityScore - left.priorityScore);
}

function buildWhyNowSummary(task: Task, priorityScore: number, expectedRoi: number): string {
  return `今やる価値が高い。スコア ${priorityScore.toFixed(2)} / ROI ${expectedRoi.toFixed(2)}`;
}
