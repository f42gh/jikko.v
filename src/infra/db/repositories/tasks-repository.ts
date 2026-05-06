import { desc, eq } from "drizzle-orm";
import { db } from "../client";
import { tasks, taskEvents } from "../schema";
import { isTauriRuntime } from "../../system/tauri";
import { taskSchema, type Task } from "../../../domain/tasks/types";
import type { SeedData, TaskEvent } from "../types";
import { seedDemoData } from "../seed";

const LOCAL_STORAGE_KEY = "jikko.local.seed-data.v1";

export const tasksRepository = {
  async load() {
    if (isTauriRuntime()) {
      return loadFromTauri();
    }

    return loadFromLocalStorage();
  },
  async createTask(task: Task, event: TaskEvent) {
    if (isTauriRuntime()) {
      await db.insert(tasks).values(task);
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
      await db.update(tasks).set(task).where(eq(tasks.id, task.id));
      await db.insert(taskEvents).values(event);
      return;
    }

    const current = await loadFromLocalStorage();
    current.tasks = current.tasks.map((item) => (item.id === task.id ? task : item));
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

  await db.insert(tasks).values(seedDemoData.tasks);
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

function parseTask(task: typeof tasks.$inferSelect): Task {
  return taskSchema.parse({
    ...task,
    parentTaskId: task.parentTaskId ?? null,
    dueAt: task.dueAt ?? null,
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
