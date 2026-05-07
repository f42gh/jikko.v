import type { CreateTaskInput, Task } from "./types";

export function createObservedTask(input: CreateTaskInput, parentTaskId: string | null = null): Task {
  const timestamp = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    title: input.title,
    status: "observe",
    parentTaskId,
    observeMemo: input.observeMemo,
    orientMemo: "",
    roiScore: null,
    estimatedMinutes: null,
    actStartedAt: null,
    actDueAt: null,
    progressNote: "",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
