import type { Task } from "../../domain/tasks/types";

export type TaskEvent = {
  id: string;
  taskId: string;
  eventType: "created" | "decomposed" | "recommended" | "started" | "completed" | "skipped" | "snoozed";
  payloadJson: string;
  createdAt: string;
};

export type SeedData = {
  tasks: Task[];
  events: TaskEvent[];
};
