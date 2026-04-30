import type { Task } from "../tasks/types";

export type ScoreWeights = {
  urgency: number;
  impact: number;
  penaltyOfDelay: number;
  momentumGain: number;
  effortEstimate: number;
  emotionalResistance: number;
  energyRequired: number;
};

export type Recommendation = {
  task: Task;
  priorityScore: number;
  expectedRoi: number;
  whyNowSummary: string;
  breakdown: Record<string, number>;
};
