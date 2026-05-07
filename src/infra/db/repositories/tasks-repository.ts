import { desc, eq } from "drizzle-orm";
import { db } from "../client";
import { tasks, taskEvents } from "../schema";
import { isTauriRuntime } from "../../system/tauri";
import { taskSchema, type Task } from "../../../domain/tasks/types";
import type { SeedData, TaskEvent } from "../types";
import { seedDemoData } from "../seed";

const LOCAL_STORAGE_KEY = "jikko.local.seed-data.v3";

export const tasksRepository = {
  async load() {
    if (isTauriRuntime()) {
      return loadFromTauri();
    }

    return loadFromLocalStorage();
  },
  async createTask(task: Task, event: TaskEvent) {
    if (isTauriRuntime()) {
      await db.insert(tasks).values(mapTaskRecord(task));
      await db.insert(taskEvents).values(event);
      return;
    }

    const current = await loadFromLocalStorage();
    current.tasks.push(task);
    current.events.push(event);
    saveToLocalStorage(current);
  },
  async updateTask(task: Task, event: TaskEvent) {
    if (isTauriRuntime()) {
      await db.update(tasks).set(mapTaskRecord(task)).where(eq(tasks.id, task.id));
      await db.insert(taskEvents).values(event);
      return;
    }

    const current = await loadFromLocalStorage();
    current.tasks = current.tasks.map((item) => (item.id === task.id ? task : item));
    current.events.push(event);
    saveToLocalStorage(current);
  },
  async appendEvent(event: TaskEvent) {
    if (isTauriRuntime()) {
      await db.insert(taskEvents).values(event);
      return;
    }

    const current = await loadFromLocalStorage();
    current.events.push(event);
    saveToLocalStorage(current);
  },
};

async function loadFromTauri(): Promise<SeedData> {
  const storedTasks = await db.select().from(tasks).orderBy(desc(tasks.createdAt));
  const storedEvents = await db.select().from(taskEvents).orderBy(desc(taskEvents.createdAt));

  if (storedTasks.length > 0) {
    return {
      tasks: [...storedTasks].reverse().map(parseTask),
      events: [...storedEvents].reverse().map(parseTaskEvent),
    };
  }

  await db.insert(tasks).values(seedDemoData.tasks.map(mapTaskRecord));
  await db.insert(taskEvents).values(seedDemoData.events);

  return {
    tasks: [...seedDemoData.tasks],
    events: [...seedDemoData.events],
  };
}

async function loadFromLocalStorage(): Promise<SeedData> {
  if (typeof window === "undefined") {
    return {
      tasks: [...seedDemoData.tasks],
      events: [...seedDemoData.events],
    };
  }

  const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
  if (raw) {
    return JSON.parse(raw) as SeedData;
  }

  const initial = {
    tasks: [...seedDemoData.tasks],
    events: [...seedDemoData.events],
  };
  saveToLocalStorage(initial);
  return initial;
}

function saveToLocalStorage(data: SeedData) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
}

function mapTaskRecord(task: Task) {
  return {
    id: task.id,
    title: task.title,
    description: task.observeMemo,
    status: task.status,
    parentTaskId: task.parentTaskId,
    effortEstimate: normalizeEffortEstimate(task.estimatedMinutes),
    urgency: task.roiScore ?? 3,
    impact: task.roiScore ?? 3,
    penaltyOfDelay: task.roiScore ?? 3,
    momentumGain: task.roiScore ?? 3,
    emotionalResistance: 2,
    energyRequired: normalizeEnergyRequired(task.estimatedMinutes),
    dueAt: null,
    observeMemo: task.observeMemo,
    orientMemo: task.orientMemo,
    painScore: null,
    gainScore: task.roiScore,
    deadlineAt: null,
    estimatedMinutes: task.estimatedMinutes,
    actStartedAt: task.actStartedAt,
    actDueAt: task.actDueAt,
    progressNote: task.progressNote,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

function parseTask(task: typeof tasks.$inferSelect): Task {
  return taskSchema.parse({
    id: task.id,
    title: task.title,
    status: task.status,
    parentTaskId: task.parentTaskId ?? null,
    observeMemo: task.observeMemo || task.description || "",
    orientMemo: task.orientMemo ?? "",
    roiScore: task.gainScore ?? task.impact ?? null,
    estimatedMinutes: task.estimatedMinutes ?? null,
    actStartedAt: task.actStartedAt ?? null,
    actDueAt: task.actDueAt ?? null,
    progressNote: task.progressNote ?? "",
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  });
}

function parseTaskEvent(event: typeof taskEvents.$inferSelect): TaskEvent {
  return {
    id: event.id,
    taskId: event.taskId,
    eventType: event.eventType as TaskEvent["eventType"],
    payloadJson: event.payloadJson,
    createdAt: event.createdAt,
  };
}

function normalizeEffortEstimate(estimatedMinutes: number | null) {
  if (!estimatedMinutes) {
    return 3;
  }

  if (estimatedMinutes <= 15) {
    return 1;
  }
  if (estimatedMinutes <= 30) {
    return 2;
  }
  if (estimatedMinutes <= 60) {
    return 3;
  }
  if (estimatedMinutes <= 120) {
    return 4;
  }
  return 5;
}

function normalizeEnergyRequired(estimatedMinutes: number | null) {
  if (!estimatedMinutes) {
    return 3;
  }

  return Math.min(5, Math.max(1, Math.ceil(estimatedMinutes / 45)));
}
