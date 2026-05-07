import { create } from "zustand";
import { buildAnalysisMetrics } from "../domain/analysis/metrics";
import { buildAnalysisSuggestions } from "../domain/analysis/suggestions";
import type { AnalysisSuggestion } from "../domain/analysis/types";
import { defaultScoreWeights } from "../domain/scoring/defaults";
import { rankTasks, scoreTask } from "../domain/scoring/engine";
import type { Recommendation, ScoreWeights } from "../domain/scoring/types";
import { createObservedTask } from "../domain/tasks/factory";
import type { CreateTaskInput, OrientTaskInput, Task, TimeoutActInput } from "../domain/tasks/types";
import { selectNextTask } from "../domain/planning/select-next";
import { tasksRepository } from "../infra/db/repositories/tasks-repository";
import type { TaskEvent } from "../infra/db/types";
import { runAnalysisHelper } from "../infra/system/analysis-helper";
import { isTauriRuntime } from "../infra/system/tauri";

type AnalysisMetrics = ReturnType<typeof buildAnalysisMetrics>;

type TaskState = {
  isReady: boolean;
  tasks: Task[];
  events: TaskEvent[];
  weights: ScoreWeights;
  rankedTasks: Recommendation[];
  recommendation: Recommendation | null;
  analysisMetrics: AnalysisMetrics;
  analysisSuggestions: AnalysisSuggestion[];
  analysisSource: "typescript" | "python";
  analysisSyncState: "idle" | "syncing" | "error";
  initialize: () => Promise<void>;
  addObservedTask: (input: CreateTaskInput) => Promise<void>;
  orientTask: (taskId: string, input: OrientTaskInput) => Promise<void>;
  decideNextTask: () => Promise<Recommendation | null>;
  startAct: (taskId: string) => Promise<void>;
  timeoutAct: (taskId: string, input: TimeoutActInput) => Promise<void>;
  completeAct: (taskId: string) => Promise<void>;
  decomposeTask: (taskId: string, input: CreateTaskInput) => Promise<void>;
  updateWeight: (key: keyof ScoreWeights, value: number) => void;
  refreshAnalysis: () => Promise<void>;
};

const emptyAnalysisMetrics = buildAnalysisMetrics([], [], []);

export const useTaskStore = create<TaskState>((set, get) => ({
  isReady: false,
  tasks: [],
  events: [],
  weights: defaultScoreWeights,
  rankedTasks: [],
  recommendation: null,
  analysisMetrics: emptyAnalysisMetrics,
  analysisSuggestions: buildAnalysisSuggestions(emptyAnalysisMetrics, defaultScoreWeights),
  analysisSource: "typescript",
  analysisSyncState: "idle",
  initialize: async () => {
    const seedData = await tasksRepository.load();
    const reconciled = await reconcileExpiredActs(seedData.tasks, seedData.events);
    set({
      isReady: true,
      tasks: reconciled.tasks,
      events: reconciled.events,
      ...deriveTaskState(reconciled.tasks, reconciled.events, defaultScoreWeights),
    });
    void syncAnalysisWithHelper(set, get, reconciled.tasks, reconciled.events, defaultScoreWeights);
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
    const event = createEvent(taskId, "completed", {
      actualMinutes: calculateActualMinutes(currentTask.actStartedAt),
      estimatedMinutes: currentTask.estimatedMinutes,
      roiScore: currentTask.roiScore,
    });
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

    set({
      weights,
      ...deriveTaskState(get().tasks, get().events, weights),
    });
    void syncAnalysisWithHelper(set, get, get().tasks, get().events, weights);
  },
  refreshAnalysis: async () => {
    await syncAnalysisWithHelper(set, get, get().tasks, get().events, get().weights);
  },
}));

function recompute(
  set: (partial: Partial<TaskState>) => void,
  get: () => TaskState,
  tasks: Task[],
  events: TaskEvent[],
) {
  set({
    tasks,
    events,
    ...deriveTaskState(tasks, events, get().weights),
  });
  void syncAnalysisWithHelper(set, get, tasks, events, get().weights);
}

function computeRecommendation(tasks: Task[], rankedTasks: Recommendation[], weights: ScoreWeights) {
  const activeTask = tasks.find((task) => task.status === "act");
  if (activeTask) {
    return scoreTask(activeTask, weights);
  }

  return selectNextTask(rankedTasks);
}

export function deriveTaskState(tasks: Task[], events: TaskEvent[], weights: ScoreWeights) {
  const rankedTasks = rankTasks(tasks, weights);
  const analysisMetrics = buildAnalysisMetrics(events, rankedTasks, tasks);

  return {
    rankedTasks,
    recommendation: computeRecommendation(tasks, rankedTasks, weights),
    analysisMetrics,
    analysisSuggestions: buildAnalysisSuggestions(analysisMetrics, weights),
    analysisSource: "typescript" as const,
  };
}

async function syncAnalysisWithHelper(
  set: (partial: Partial<TaskState>) => void,
  get: () => TaskState,
  tasks: Task[],
  events: TaskEvent[],
  weights: ScoreWeights,
) {
  if (!isTauriRuntime()) {
    return;
  }

  const signature = buildAnalysisSignature(tasks, events, weights);
  set({ analysisSyncState: "syncing" });

  try {
    const rankedTasks = rankTasks(tasks, weights);
    const result = await runAnalysisHelper({
      tasks,
      events,
      weights,
      rankedTasks,
    });

    if (!result) {
      set({ analysisSyncState: "idle" });
      return;
    }

    if (signature !== buildAnalysisSignature(get().tasks, get().events, get().weights)) {
      return;
    }

    set({
      analysisMetrics: result.analysisMetrics,
      analysisSuggestions: result.analysisSuggestions,
      analysisSource: "python",
      analysisSyncState: "idle",
    });
  } catch {
    if (signature !== buildAnalysisSignature(get().tasks, get().events, get().weights)) {
      return;
    }

    set({
      analysisSource: "typescript",
      analysisSyncState: "error",
    });
  }
}

function buildAnalysisSignature(tasks: Task[], events: TaskEvent[], weights: ScoreWeights) {
  return JSON.stringify({
    weights,
    tasks: tasks.map((task) => [task.id, task.updatedAt, task.status]),
    events: events.map((event) => [event.id, event.createdAt, event.eventType]),
  });
}

function createEvent(
  taskId: string,
  eventType: TaskEvent["eventType"],
  payload: Record<string, unknown> = {},
): TaskEvent {
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

function calculateActualMinutes(actStartedAt: string | null) {
  if (!actStartedAt) {
    return null;
  }

  return Math.max(1, Math.round((Date.now() - new Date(actStartedAt).getTime()) / 60000));
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
