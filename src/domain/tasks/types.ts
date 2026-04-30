import { z } from "zod";

export const taskStatusSchema = z.enum(["pending", "in_progress", "done", "snoozed"]);

export const taskSchema = z.object({
  id: z.string(),
  title: z.string().min(1, "Title is required."),
  description: z.string().default(""),
  status: taskStatusSchema,
  parentTaskId: z.string().nullable(),
  effortEstimate: z.number().min(1).max(5),
  urgency: z.number().min(1).max(5),
  impact: z.number().min(1).max(5),
  penaltyOfDelay: z.number().min(1).max(5),
  momentumGain: z.number().min(1).max(5),
  emotionalResistance: z.number().min(1).max(5),
  energyRequired: z.number().min(1).max(5),
  dueAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const createTaskInputSchema = taskSchema.omit({
  id: true,
  status: true,
  parentTaskId: true,
  dueAt: true,
  createdAt: true,
  updatedAt: true,
});

export type Task = z.infer<typeof taskSchema>;
export type CreateTaskInput = z.infer<typeof createTaskInputSchema>;
