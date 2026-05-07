import type { Recommendation } from "../scoring/types";
import type { Task } from "../tasks/types";
import type { TaskEvent } from "../../infra/db/types";

export function buildHistoryMetrics(events: TaskEvent[], rankedTasks: Recommendation[], tasks: Task[]) {
  const completedEvents = events.filter((event) => event.eventType === "completed");
  const timeoutEvents = events.filter((event) => event.eventType === "act_timed_out");
  const reorientedEvents = events.filter((event) => event.eventType === "reoriented");
  const decomposedEvents = events.filter((event) => event.eventType === "decomposed");
  const childTasks = tasks.filter((task) => task.parentTaskId !== null);
  const completedChildren = childTasks.filter((task) => task.status === "done");
  const totalRoi = rankedTasks.reduce((total, item) => total + item.expectedRoi, 0);

  return {
    completedCount: completedEvents.length,
    timeoutCount: timeoutEvents.length,
    reorientedCount: reorientedEvents.length,
    decompositionCount: decomposedEvents.length,
    decompositionCompletionRate: childTasks.length === 0 ? 0 : completedChildren.length / childTasks.length,
    confidenceScore: completedEvents.length * 1.2 + reorientedEvents.length * 0.4,
    totalRoi,
    chartData: buildChartData(completedEvents),
  };
}

function buildChartData(completedEvents: TaskEvent[]) {
  const today = new Date();
  const labels = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(today);
    day.setDate(today.getDate() - (6 - index));
    return day.toISOString().slice(5, 10);
  });

  return labels.map((label) => {
    const completed = completedEvents.filter((event) => event.createdAt.slice(5, 10) === label).length;
    return { label, completed };
  });
}
