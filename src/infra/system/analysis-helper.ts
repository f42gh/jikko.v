import { invoke } from "@tauri-apps/api/core";
import type { AnalysisMetrics, AnalysisSuggestion } from "../../domain/analysis/types";
import type { Recommendation, ScoreWeights } from "../../domain/scoring/types";
import type { Task } from "../../domain/tasks/types";
import type { TaskEvent } from "../db/types";
import { isTauriRuntime } from "./tauri";

export type AnalysisHelperInput = {
  tasks: Task[];
  events: TaskEvent[];
  weights: ScoreWeights;
  rankedTasks: Recommendation[];
};

export type AnalysisHelperOutput = {
  analysisMetrics: AnalysisMetrics;
  analysisSuggestions: AnalysisSuggestion[];
};

export async function runAnalysisHelper(payload: AnalysisHelperInput) {
  if (!isTauriRuntime()) {
    return null;
  }

  return invoke<AnalysisHelperOutput>("run_analysis_helper", { payload });
}
