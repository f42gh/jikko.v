import { create } from "zustand";
import { createTask } from "../domain/tasks/factory";
import type { CreateTaskInput, Task } from "../domain/tasks/types";
import { defaultScoreWeights } from "../domain/scoring/defaults";
import { rankTasks } from "../domain/scoring/engine";
import type { Recommendation, ScoreWeights } from "../domain/scoring/types";
import { selectNextTask } from "../domain/planning/select-next";
import { buildHistoryMetrics } from "../domain/history/metrics";
import type { SeedData, TaskEvent } from "../infra/db/types";

type HistoryMetrics = ReturnType<typeof buildHistoryMetrics>;

type TaskState = {
  isReady: boolean;
  tasks: Task[];
  events: TaskEvent[];
  weights: ScoreWeights;
  rankedTasks: Recommendation[];
  recommendation: Recommendation | null;
  historyMetrics: HistoryMetrics;
  initialize: (seedData: SeedData) => Promise<void>;
  addTask: (input: CreateTaskInput) => void;
  startTask: (taskId: string) => void;
  completeTask: (taskId: string) => void;
  updateWeight: (key: string, value: number) => void;
};

const emptyHistoryMetrics = buildHistoryMetrics([], []);

export const useTaskStore = create<TaskState>((set, get) => ({
  isReady: false,
  tasks: [],
  events: [],
  weights: defaultScoreWeights,
  rankedTasks: [],
  recommendation: null,
  historyMetrics: emptyHistoryMetrics,
  initialize: async (seedData) => {
    const rankedTasks = rankTasks(seedData.tasks, defaultScoreWeights);
    set({
      isReady: true,
      tasks: seedData.tasks,
      events: seedData.events,
      rankedTasks,
      recommendation: selectNextTask(rankedTasks),
      historyMetrics: buildHistoryMetrics(seedData.events, rankedTasks),
    });
  },
  addTask: (input) => {
    const task = createTask(input);
    const nextTasks = [...get().tasks, task];
    recompute(set, get, nextTasks, [
      ...get().events,
      createEvent(task.id, "created"),
    ]);
  },
  startTask: (taskId) => {
    const nextTasks = get().tasks.map((task) =>
      task.id === taskId ? withStatus(task, "in_progress") : task,
    );
    recompute(set, get, nextTasks, [...get().events, createEvent(taskId, "started")]);
  },
  completeTask: (taskId) => {
    const nextTasks = get().tasks.map((task) =>
      task.id === taskId ? withStatus(task, "done") : task,
    );
    recompute(set, get, nextTasks, [...get().events, createEvent(taskId, "completed")]);
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
      recommendation: selectNextTask(rankedTasks),
      historyMetrics: buildHistoryMetrics(get().events, rankedTasks),
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
    recommendation: selectNextTask(rankedTasks),
    historyMetrics: buildHistoryMetrics(events, rankedTasks),
  });
}

function createEvent(taskId: string, eventType: TaskEvent["eventType"]): TaskEvent {
  return {
    id: crypto.randomUUID(),
    taskId,
    eventType,
    payloadJson: "{}",
    createdAt: new Date().toISOString(),
  };
}

function withStatus(task: Task, status: Task["status"]): Task {
  return {
    ...task,
    status,
    updatedAt: new Date().toISOString(),
  };
}
