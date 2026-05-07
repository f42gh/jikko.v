import { create } from "zustand";
import { createObservedTask } from "../domain/tasks/factory";
import type { CreateTaskInput, OrientTaskInput, Task, TimeoutActInput } from "../domain/tasks/types";
import { defaultScoreWeights } from "../domain/scoring/defaults";
import { rankTasks, scoreTask } from "../domain/scoring/engine";
import type { Recommendation, ScoreWeights } from "../domain/scoring/types";
import { selectNextTask } from "../domain/planning/select-next";
import { buildHistoryMetrics } from "../domain/history/metrics";
import type { TaskEvent } from "../infra/db/types";
import { tasksRepository } from "../infra/db/repositories/tasks-repository";

type HistoryMetrics = ReturnType<typeof buildHistoryMetrics>;

type TaskState = {
  isReady: boolean;
  tasks: Task[];
  events: TaskEvent[];
  weights: ScoreWeights;
  rankedTasks: Recommendation[];
  recommendation: Recommendation | null;
  historyMetrics: HistoryMetrics;
  initialize: () => Promise<void>;
  addObservedTask: (input: CreateTaskInput) => Promise<void>;
  orientTask: (taskId: string, input: OrientTaskInput) => Promise<void>;
  decideNextTask: () => Promise<Recommendation | null>;
  startAct: (taskId: string) => Promise<void>;
  timeoutAct: (taskId: string, input: TimeoutActInput) => Promise<void>;
  completeAct: (taskId: string) => Promise<void>;
  decomposeTask: (taskId: string, input: CreateTaskInput) => Promise<void>;
  updateWeight: (key: keyof ScoreWeights, value: number) => void;
};

const emptyHistoryMetrics = buildHistoryMetrics([], [], []);

export const useTaskStore = create<TaskState>((set, get) => ({
  isReady: false,
  tasks: [],
  events: [],
  weights: defaultScoreWeights,
  rankedTasks: [],
  recommendation: null,
  historyMetrics: emptyHistoryMetrics,
  initialize: async () => {
    const seedData = await tasksRepository.load();
    const reconciled = await reconcileExpiredActs(seedData.tasks, seedData.events);
    const rankedTasks = rankTasks(reconciled.tasks, defaultScoreWeights);
    set({
      isReady: true,
      tasks: reconciled.tasks,
      events: reconciled.events,
      rankedTasks,
      recommendation: computeRecommendation(reconciled.tasks, rankedTasks, defaultScoreWeights),
      historyMetrics: buildHistoryMetrics(reconciled.events, rankedTasks, reconciled.tasks),
    });
  },
  addObservedTask: async (input) => {
    const task = createObservedTask(input);
    const event = createEvent(task.id, "created");
    await tasksRepository.createTask(task, event);
    recompute(set, get, [...get().tasks, task], [...get().events, event]);
  },
  orientTask: async (taskId, input) => {
    const currentTask = get().tasks.find((task) => task.id === taskId);
    if (!currentTask) {
      return;
    }

    const updatedTask = applyOrientTask(currentTask, input);
    const event = createEvent(
      taskId,
      currentTask.status === "observe" ? "oriented" : "reoriented",
      input,
    );
    await tasksRepository.updateTask(updatedTask, event);
    const nextTasks = get().tasks.map((task) => (task.id === taskId ? updatedTask : task));
    recompute(set, get, nextTasks, [...get().events, event]);
  },
  decideNextTask: async () => {
    const rankedTasks = rankTasks(get().tasks, get().weights);
    const recommendation = selectNextTask(rankedTasks);
    if (!recommendation) {
      return null;
    }

    const event = createEvent(recommendation.task.id, "decided", {
      priorityScore: recommendation.priorityScore,
    });
    await tasksRepository.appendEvent(event);
    recompute(set, get, get().tasks, [...get().events, event]);
    return recommendation;
  },
  startAct: async (taskId) => {
    const currentTask = get().tasks.find((task) => task.id === taskId);
    if (!currentTask || currentTask.status !== "orient" || currentTask.estimatedMinutes === null) {
      return;
    }

    const updatedTask = applyStartActTask(currentTask);
    const event = createEvent(taskId, "act_started", {
      estimatedMinutes: updatedTask.estimatedMinutes,
      actDueAt: updatedTask.actDueAt,
    });
    await tasksRepository.updateTask(updatedTask, event);
    const nextTasks = get().tasks.map((task) => (task.id === taskId ? updatedTask : ensureNotAct(task)));
    recompute(set, get, nextTasks, [...get().events, event]);
  },
  timeoutAct: async (taskId, input) => {
    const currentTask = get().tasks.find((task) => task.id === taskId);
    if (!currentTask || currentTask.status !== "act") {
      return;
    }

    const updatedTask = applyTimeoutActTask(currentTask, input);
    const event = createEvent(taskId, "act_timed_out", input);
    await tasksRepository.updateTask(updatedTask, event);
    const nextTasks = get().tasks.map((task) => (task.id === taskId ? updatedTask : task));
    recompute(set, get, nextTasks, [...get().events, event]);
  },
  completeAct: async (taskId) => {
    const currentTask = get().tasks.find((task) => task.id === taskId);
    if (!currentTask || currentTask.status !== "act") {
      return;
    }

    const updatedTask = applyCompleteActTask(currentTask);
    const event = createEvent(taskId, "completed");
    await tasksRepository.updateTask(updatedTask, event);
    const nextTasks = get().tasks.map((task) => (task.id === taskId ? updatedTask : task));
    recompute(set, get, nextTasks, [...get().events, event]);
  },
  decomposeTask: async (taskId, input) => {
    const parentTask = get().tasks.find((task) => task.id === taskId);
    if (!parentTask) {
      return;
    }

    const childTask = createObservedTask(input, taskId);
    const childEvent = createEvent(childTask.id, "created", { parentTaskId: taskId });
    await tasksRepository.createTask(childTask, childEvent);

    const parentEvent = createEvent(taskId, "decomposed", { childTaskId: childTask.id });
    await tasksRepository.appendEvent(parentEvent);

    recompute(set, get, [...get().tasks, childTask], [...get().events, childEvent, parentEvent]);
  },
  updateWeight: (key, value) => {
    const weights = {
      ...get().weights,
      [key]: value,
    };
    const rankedTasks = rankTasks(get().tasks, weights);
    set({
      weights,
      rankedTasks,
      recommendation: computeRecommendation(get().tasks, rankedTasks, weights),
      historyMetrics: buildHistoryMetrics(get().events, rankedTasks, get().tasks),
    });
  },
}));

function recompute(
  set: (partial: Partial<TaskState>) => void,
  get: () => TaskState,
  tasks: Task[],
  events: TaskEvent[],
) {
  const rankedTasks = rankTasks(tasks, get().weights);
  set({
    tasks,
    events,
    rankedTasks,
    recommendation: computeRecommendation(tasks, rankedTasks, get().weights),
    historyMetrics: buildHistoryMetrics(events, rankedTasks, tasks),
  });
}

function computeRecommendation(tasks: Task[], rankedTasks: Recommendation[], weights: ScoreWeights) {
  const activeTask = tasks.find((task) => task.status === "act");
  if (activeTask) {
    return scoreTask(activeTask, weights);
  }

  return selectNextTask(rankedTasks);
}

function createEvent(taskId: string, eventType: TaskEvent["eventType"], payload: Record<string, unknown> = {}): TaskEvent {
  return {
    id: crypto.randomUUID(),
    taskId,
    eventType,
    payloadJson: JSON.stringify(payload),
    createdAt: new Date().toISOString(),
  };
}

async function reconcileExpiredActs(tasks: Task[], events: TaskEvent[]) {
  let nextTasks = tasks;
  let nextEvents = events;
  const expired = tasks.filter(
    (task) => task.status === "act" && task.actDueAt && new Date(task.actDueAt).getTime() <= Date.now(),
  );

  for (const task of expired) {
    const updatedTask = applyTimeoutActTask(task, {
      roiScore: task.roiScore ?? 3,
      estimatedMinutes: task.estimatedMinutes ?? 25,
      orientMemo: task.orientMemo,
      progressNote: task.progressNote || "時間切れのため再評価へ戻しました。",
    });
    const event = createEvent(task.id, "act_timed_out", { automatic: true });
    await tasksRepository.updateTask(updatedTask, event);
    nextTasks = nextTasks.map((item) => (item.id === task.id ? updatedTask : item));
    nextEvents = [...nextEvents, event];
  }

  return { tasks: nextTasks, events: nextEvents };
}

function ensureNotAct(task: Task): Task {
  if (task.status !== "act") {
    return task;
  }

  return {
    ...task,
    status: "orient",
    actStartedAt: null,
    actDueAt: null,
    updatedAt: new Date().toISOString(),
  };
}

export function applyOrientTask(task: Task, input: OrientTaskInput): Task {
  return {
    ...task,
    status: "orient",
    roiScore: input.roiScore,
    estimatedMinutes: input.estimatedMinutes,
    orientMemo: input.orientMemo,
    actStartedAt: null,
    actDueAt: null,
    updatedAt: new Date().toISOString(),
  };
}

export function applyStartActTask(task: Task): Task {
  const now = new Date();
  const estimatedMinutes = task.estimatedMinutes ?? 25;
  const actDueAt = new Date(now.getTime() + estimatedMinutes * 60 * 1000).toISOString();

  return {
    ...task,
    status: "act",
    actStartedAt: now.toISOString(),
    actDueAt,
    updatedAt: now.toISOString(),
  };
}

export function applyTimeoutActTask(task: Task, input: TimeoutActInput): Task {
  return {
    ...task,
    status: "orient",
    roiScore: input.roiScore,
    estimatedMinutes: input.estimatedMinutes,
    orientMemo: input.orientMemo,
    progressNote: input.progressNote,
    actStartedAt: null,
    actDueAt: null,
    updatedAt: new Date().toISOString(),
  };
}

export function applyCompleteActTask(task: Task): Task {
  return {
    ...task,
    status: "done",
    actStartedAt: task.actStartedAt,
    actDueAt: null,
    updatedAt: new Date().toISOString(),
  };
}
