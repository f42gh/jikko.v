import type { ScoreWeights } from "../scoring/types";

export type AnalysisSeriesPoint = {
  label: string;
  estimated: number;
  actual: number;
};

export type FlowSeriesPoint = {
  label: string;
  completed: number;
  timedOut: number;
  reoriented: number;
};

export type AnalysisSummary = {
  completedCount: number;
  timeoutCount: number;
  reorientedCount: number;
  decompositionCount: number;
  completionRate: number;
  timeoutRate: number;
  reorientationRate: number;
  decompositionCompletionRate: number;
  averageRoiGap: number;
  averageMinutesGap: number;
  focusStability: number;
  totalExpectedRoi: number;
};

export type AnalysisMetrics = {
  summary: AnalysisSummary;
  roiSeries: AnalysisSeriesPoint[];
  effortSeries: AnalysisSeriesPoint[];
  flowSeries: FlowSeriesPoint[];
};

export type AnalysisSuggestion = {
  id: string;
  kind: "weight" | "input" | "decomposition" | "confidence";
  title: string;
  summary: string;
  impactLabel: string;
  recommendedWeights?: Partial<ScoreWeights>;
};
