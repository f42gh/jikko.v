import type { Task } from "../tasks/types";

export type ScoreWeights = {
  roi: number;
  effortPenalty: number;
};

export type Recommendation = {
  task: Task;
  priorityScore: number;
  expectedRoi: number;
  whyNowSummary: string;
  breakdown: {
    roi: number;
    effortPenalty: number;
  };
};
