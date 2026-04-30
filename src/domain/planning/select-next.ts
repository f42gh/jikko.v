import type { Recommendation } from "../scoring/types";

export function selectNextTask(recommendations: Recommendation[]) {
  return recommendations[0] ?? null;
}
