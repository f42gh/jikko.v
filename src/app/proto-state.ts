import { derived, get, writable } from "svelte/store";
import { defaultScoreWeights } from "../domain/scoring/defaults";
import { rankTasks, scoreTask } from "../domain/scoring/engine";
import type { Recommendation, ScoreWeights } from "../domain/scoring/types";
import { createObservedTask } from "../domain/tasks/factory";
import type { CreateTaskInput, OrientTaskInput, Task, TimeoutActInput } from "../domain/tasks/types";
import { selectNextTask } from "../domain/planning/select-next";
import { tasksRepository } from "../infra/db/repositories/tasks-repository";
import type { TaskEvent } from "../infra/db/types";

type ProtoState = {
  ready: boolean;
  tasks: Task[];
  events: TaskEvent[];
  weights: ScoreWeights;
};

const initialState: ProtoState = {
  ready: false,
  tasks: [],
  events: [],
  weights: defaultScoreWeights,
};

const state = writable<ProtoState>(initialState);

export const appState = {
  subscribe: state.subscribe,
};

export const observeTasks = derived(state, ($state) =>
  $state.tasks.filter((task) => task.status === "observe").reverse(),
);

export const orientTasks = derived(state, ($state) =>
  rankTasks($state.tasks, $state.weights),
);

export const activeTask = derived(state, ($state) => $state.tasks.find((task) => task.status === "act") ?? null);

export const recommendation = derived(
  [state, orientTasks, activeTask],
  ([$state, $orientTasks, $activeTask]) => {
    if ($activeTask) {
      return scoreTask($activeTask, $state.weights);
    }

    return selectNextTask($orientTasks);
  },
);

export async function initializeApp() {
  const seedData = await tasksRepository.load();
  const reconciled = await reconcileExpiredActs(seedData.tasks, seedData.events);
  state.set({
    ready: true,
    tasks: reconciled.tasks,
    events: reconciled.events,
    weights: defaultScoreWeights,
  });
}

export async function addTask(input: CreateTaskInput) {
  const task = createObservedTask(input);
  const event = createEvent(task.id, "created");
  await tasksRepository.createTask(task, event);
  commitState((current) => ({
    ...current,
    tasks: [...current.tasks, task],
    events: [...current.events, event],
  }));
}

export async function saveOrientation(taskId: string, input: OrientTaskInput) {
  const current = get(state);
  const task = current.tasks.find((item) => item.id === taskId);
  if (!task) {
    return;
  }

  const updatedTask = applyOrientTask(task, input);
  const event = createEvent(taskId, task.status === "observe" ? "oriented" : "reoriented", input);
  await tasksRepository.updateTask(updatedTask, event);
  commitState((snapshot) => ({
    ...snapshot,
    tasks: snapshot.tasks.map((item) => (item.id === taskId ? updatedTask : item)),
    events: [...snapshot.events, event],
  }));
}

export async function startTask(taskId: string) {
  const current = get(state);
  const task = current.tasks.find((item) => item.id === taskId);
  if (!task || task.status !== "orient" || task.estimatedMinutes === null) {
    return;
  }

  const updatedTask = applyStartActTask(task);
  const event = createEvent(taskId, "act_started", {
    estimatedMinutes: updatedTask.estimatedMinutes,
    actDueAt: updatedTask.actDueAt,
  });
  await tasksRepository.updateTask(updatedTask, event);
  commitState((snapshot) => ({
    ...snapshot,
    tasks: snapshot.tasks.map((item) => (item.id === taskId ? updatedTask : ensureNotAct(item))),
    events: [...snapshot.events, event],
  }));
}

export async function startRecommendedTask() {
  const next = get(recommendation);
  if (!next) {
    return;
  }

  await startTask(next.task.id);
}

export async function timeoutTask(taskId: string, input: TimeoutActInput) {
  const current = get(state);
  const task = current.tasks.find((item) => item.id === taskId);
  if (!task || task.status !== "act") {
    return;
  }

  const updatedTask = applyTimeoutActTask(task, input);
  const event = createEvent(taskId, "act_timed_out", input);
  await tasksRepository.updateTask(updatedTask, event);
  commitState((snapshot) => ({
    ...snapshot,
    tasks: snapshot.tasks.map((item) => (item.id === taskId ? updatedTask : item)),
    events: [...snapshot.events, event],
  }));
}

export async function completeTask(taskId: string) {
  const current = get(state);
  const task = current.tasks.find((item) => item.id === taskId);
  if (!task || task.status !== "act") {
    return;
  }

  const updatedTask = applyCompleteActTask(task);
  const event = createEvent(taskId, "completed", {
    actualMinutes: calculateActualMinutes(task.actStartedAt),
    estimatedMinutes: task.estimatedMinutes,
    roiScore: task.roiScore,
  });
  await tasksRepository.updateTask(updatedTask, event);
  commitState((snapshot) => ({
    ...snapshot,
    tasks: snapshot.tasks.map((item) => (item.id === taskId ? updatedTask : item)),
    events: [...snapshot.events, event],
  }));
}

function commitState(update: (current: ProtoState) => ProtoState) {
  state.update((current) => update(current));
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

function applyOrientTask(task: Task, input: OrientTaskInput): Task {
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

function applyStartActTask(task: Task): Task {
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

function applyTimeoutActTask(task: Task, input: TimeoutActInput): Task {
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

function applyCompleteActTask(task: Task): Task {
  return {
    ...task,
    status: "done",
    actStartedAt: task.actStartedAt,
    actDueAt: null,
    updatedAt: new Date().toISOString(),
  };
}
