import type { Recommendation } from "../scoring/types";
import type { Task } from "../tasks/types";
import type { AnalysisMetrics, AnalysisSeriesPoint, FlowSeriesPoint } from "./types";
import type { TaskEvent } from "../../infra/db/types";

type TaskOutcome = {
  taskId: string;
  label: string;
  estimatedMinutes: number;
  actualMinutes: number;
  estimatedRoi: number;
  realizedRoi: number;
};

export function buildAnalysisMetrics(
  events: TaskEvent[],
  rankedTasks: Recommendation[],
  tasks: Task[],
): AnalysisMetrics {
  const completedEvents = events.filter((event) => event.eventType === "completed");
  const timeoutEvents = events.filter((event) => event.eventType === "act_timed_out");
  const reorientedEvents = events.filter((event) => event.eventType === "reoriented");
  const decomposedEvents = events.filter((event) => event.eventType === "decomposed");
  const childTasks = tasks.filter((task) => task.parentTaskId !== null);
  const completedChildren = childTasks.filter((task) => task.status === "done");
  const totalExpectedRoi = roundToTenth(
    rankedTasks.reduce((total, item) => total + item.expectedRoi, 0),
  );

  const outcomes = buildTaskOutcomes(tasks, events, completedEvents);
  const actionCount = completedEvents.length + timeoutEvents.length;
  const completionRate = actionCount === 0 ? 0 : completedEvents.length / actionCount;
  const timeoutRate = actionCount === 0 ? 0 : timeoutEvents.length / actionCount;
  const reorientationRate =
    completedEvents.length === 0 ? 0 : reorientedEvents.length / completedEvents.length;
  const averageRoiGap =
    outcomes.length === 0
      ? 0
      : roundToTenth(
          outcomes.reduce((total, outcome) => total + (outcome.realizedRoi - outcome.estimatedRoi), 0) /
            outcomes.length,
        );
  const averageMinutesGap =
    outcomes.length === 0
      ? 0
      : roundToTenth(
          outcomes.reduce((total, outcome) => total + (outcome.actualMinutes - outcome.estimatedMinutes), 0) /
            outcomes.length,
        );
  const focusStability = clamp(
    1 - timeoutRate * 0.65 - reorientationRate * 0.35,
    0,
    1,
  );

  return {
    summary: {
      completedCount: completedEvents.length,
      timeoutCount: timeoutEvents.length,
      reorientedCount: reorientedEvents.length,
      decompositionCount: decomposedEvents.length,
      completionRate,
      timeoutRate,
      reorientationRate,
      decompositionCompletionRate:
        childTasks.length === 0 ? 0 : completedChildren.length / childTasks.length,
      averageRoiGap,
      averageMinutesGap,
      focusStability: roundToTenth(focusStability * 100) / 100,
      totalExpectedRoi,
    },
    roiSeries: buildSeries(outcomes, "roi", events),
    effortSeries: buildSeries(outcomes, "effort", events),
    flowSeries: buildFlowSeries(events),
  };
}

function buildTaskOutcomes(tasks: Task[], events: TaskEvent[], completedEvents: TaskEvent[]): TaskOutcome[] {
  return completedEvents
    .map((event) => {
      const task = tasks.find((candidate) => candidate.id === event.taskId);
      if (!task || task.roiScore === null || task.estimatedMinutes === null) {
        return null;
      }

      const taskEvents = events.filter((candidate) => candidate.taskId === task.id);
      const timeoutCount = taskEvents.filter((candidate) => candidate.eventType === "act_timed_out").length;
      const reorientedCount = taskEvents.filter((candidate) => candidate.eventType === "reoriented").length;
      const payload = parseEventPayload(event.payloadJson);
      const actualMinutes =
        typeof payload.actualMinutes === "number"
          ? payload.actualMinutes
          : estimateActualMinutes(task.actStartedAt, event.createdAt, task.estimatedMinutes);
      const realizedRoi = estimateRealizedRoi(
        task.roiScore,
        task.estimatedMinutes,
        actualMinutes,
        timeoutCount,
        reorientedCount,
      );

      return {
        taskId: task.id,
        label: event.createdAt.slice(5, 10),
        estimatedMinutes: task.estimatedMinutes,
        actualMinutes,
        estimatedRoi: task.roiScore,
        realizedRoi,
      };
    })
    .filter((outcome): outcome is TaskOutcome => outcome !== null);
}

function buildSeries(
  outcomes: TaskOutcome[],
  kind: "roi" | "effort",
  events: TaskEvent[],
): AnalysisSeriesPoint[] {
  const labels = buildRecentLabels(events);

  return labels.map((label) => {
    const dailyOutcomes = outcomes.filter((outcome) => outcome.label === label);
    if (dailyOutcomes.length === 0) {
      return { label, estimated: 0, actual: 0 };
    }

    if (kind === "roi") {
      return {
        label,
        estimated: roundToTenth(
          dailyOutcomes.reduce((total, outcome) => total + outcome.estimatedRoi, 0),
        ),
        actual: roundToTenth(
          dailyOutcomes.reduce((total, outcome) => total + outcome.realizedRoi, 0),
        ),
      };
    }

    return {
      label,
      estimated: roundToTenth(
        dailyOutcomes.reduce((total, outcome) => total + outcome.estimatedMinutes, 0),
      ),
      actual: roundToTenth(
        dailyOutcomes.reduce((total, outcome) => total + outcome.actualMinutes, 0),
      ),
    };
  });
}

function buildFlowSeries(events: TaskEvent[]): FlowSeriesPoint[] {
  const labels = buildRecentLabels(events);

  return labels.map((label) => ({
    label,
    completed: countEventsForLabel(events, label, "completed"),
    timedOut: countEventsForLabel(events, label, "act_timed_out"),
    reoriented: countEventsForLabel(events, label, "reoriented"),
  }));
}

function buildRecentLabels(events: TaskEvent[]) {
  const latestEventTime = events.reduce((max, event) => {
    const eventTime = new Date(event.createdAt).getTime();
    return Number.isNaN(eventTime) ? max : Math.max(max, eventTime);
  }, 0);
  const latestDate = new Date(Math.max(Date.now(), latestEventTime));
  const today = Number.isNaN(latestDate.getTime()) ? new Date() : latestDate;

  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(today);
    day.setDate(today.getDate() - (6 - index));
    return day.toISOString().slice(5, 10);
  });
}

function countEventsForLabel(events: TaskEvent[], label: string, eventType: TaskEvent["eventType"]) {
  return events.filter(
    (event) => event.eventType === eventType && event.createdAt.slice(5, 10) === label,
  ).length;
}

function estimateActualMinutes(
  actStartedAt: string | null,
  completedAt: string,
  fallbackMinutes: number,
) {
  if (!actStartedAt) {
    return fallbackMinutes;
  }

  const actualMinutes = Math.round(
    (new Date(completedAt).getTime() - new Date(actStartedAt).getTime()) / 60000,
  );

  return Math.max(1, actualMinutes || fallbackMinutes);
}

function estimateRealizedRoi(
  estimatedRoi: number,
  estimatedMinutes: number,
  actualMinutes: number,
  timeoutCount: number,
  reorientedCount: number,
) {
  const scheduleFactor = clamp(estimatedMinutes / Math.max(actualMinutes, 1), 0.55, 1.15);
  const interruptionPenalty = timeoutCount * 0.12 + reorientedCount * 0.08;
  return roundToTenth(clamp(estimatedRoi * scheduleFactor * (1 - interruptionPenalty), 0.4, 5));
}

function parseEventPayload(payloadJson: string) {
  try {
    return JSON.parse(payloadJson) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function roundToTenth(value: number) {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
