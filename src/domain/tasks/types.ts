import { z } from "zod";

export const taskStatusSchema = z.enum(["observe", "orient", "act", "done", "archived"]);

export const taskSchema = z.object({
  id: z.string(),
  title: z.string().min(1, "Title is required."),
  status: taskStatusSchema,
  parentTaskId: z.string().nullable(),
  observeMemo: z.string().default(""),
  orientMemo: z.string().default(""),
  roiScore: z.number().min(1).max(5).nullable(),
  estimatedMinutes: z.number().int().min(1).nullable(),
  actStartedAt: z.string().nullable(),
  actDueAt: z.string().nullable(),
  progressNote: z.string().default(""),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const createTaskInputSchema = z.object({
  title: z.string().min(1, "Title is required."),
  observeMemo: z.string().default(""),
});

export const orientTaskInputSchema = z.object({
  roiScore: z.number().min(1).max(5),
  estimatedMinutes: z.number().int().min(1),
  orientMemo: z.string().default(""),
});

export const timeoutActInputSchema = orientTaskInputSchema.extend({
  progressNote: z.string().default(""),
});

export type Task = z.infer<typeof taskSchema>;
export type TaskStatus = z.infer<typeof taskStatusSchema>;
export type CreateTaskInput = z.infer<typeof createTaskInputSchema>;
export type OrientTaskInput = z.infer<typeof orientTaskInputSchema>;
export type TimeoutActInput = z.infer<typeof timeoutActInputSchema>;
