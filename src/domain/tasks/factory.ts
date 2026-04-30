import type { CreateTaskInput, Task } from "./types";

export function createTask(input: CreateTaskInput): Task {
  const timestamp = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    status: "pending",
    parentTaskId: null,
    dueAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...input,
  };
}
