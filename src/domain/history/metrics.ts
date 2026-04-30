import type { Recommendation } from "../scoring/types";
import type { TaskEvent } from "../../infra/db/types";

export function buildHistoryMetrics(
  events: TaskEvent[],
  rankedTasks: Recommendation[],
) {
  const completedEvents = events.filter((event) => event.eventType === "completed");
  const totalRoi = rankedTasks.reduce((total, item) => total + item.expectedRoi, 0);

  return {
    completedCount: completedEvents.length,
    confidenceScore: completedEvents.length * 1.7,
    totalRoi,
    chartData: buildChartData(completedEvents.length),
  };
}

function buildChartData(completedCount: number) {
  return Array.from({ length: 7 }, (_, index) => ({
    label: `D${index + 1}`,
    completed: Math.max(0, completedCount - (6 - index)),
  }));
}
