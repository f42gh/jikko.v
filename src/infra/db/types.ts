import type { Task } from "../../domain/tasks/types";

export type TaskEvent = {
  id: string;
  taskId: string;
  eventType:
    | "created"
    | "oriented"
    | "reoriented"
    | "decided"
    | "act_started"
    | "act_timed_out"
    | "completed"
    | "decomposed"
    | "archived";
  payloadJson: string;
  createdAt: string;
};

export type SeedData = {
  tasks: Task[];
  events: TaskEvent[];
};
