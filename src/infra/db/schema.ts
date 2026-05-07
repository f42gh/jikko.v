import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  status: text("status").notNull(),
  parentTaskId: text("parent_task_id"),
  effortEstimate: integer("effort_estimate").notNull().default(3),
  urgency: integer("urgency").notNull().default(3),
  impact: integer("impact").notNull().default(3),
  penaltyOfDelay: integer("penalty_of_delay").notNull().default(3),
  momentumGain: integer("momentum_gain").notNull().default(3),
  emotionalResistance: integer("emotional_resistance").notNull().default(2),
  energyRequired: integer("energy_required").notNull().default(3),
  dueAt: text("due_at"),
  observeMemo: text("observe_memo").notNull().default(""),
  orientMemo: text("orient_memo").notNull().default(""),
  painScore: integer("pain_score"),
  gainScore: integer("gain_score"),
  deadlineAt: text("deadline_at"),
  estimatedMinutes: integer("estimated_minutes"),
  actStartedAt: text("act_started_at"),
  actDueAt: text("act_due_at"),
  progressNote: text("progress_note").notNull().default(""),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const taskScoreSnapshots = sqliteTable("task_score_snapshots", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull(),
  priorityScore: real("priority_score").notNull(),
  expectedRoi: real("expected_roi").notNull(),
  scoreBreakdownJson: text("score_breakdown_json").notNull(),
  whyNowSummary: text("why_now_summary").notNull(),
  createdAt: text("created_at").notNull(),
});

export const taskEvents = sqliteTable("task_events", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull(),
  eventType: text("event_type").notNull(),
  payloadJson: text("payload_json").notNull(),
  createdAt: text("created_at").notNull(),
});

export const dailyRecommendations = sqliteTable("daily_recommendations", {
  id: text("id").primaryKey(),
  date: text("date").notNull(),
  recommendedTaskId: text("recommended_task_id").notNull(),
  rationaleJson: text("rationale_json").notNull(),
  createdAt: text("created_at").notNull(),
});

export const rewardRecords = sqliteTable("reward_records", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull(),
  rewardType: text("reward_type").notNull(),
  rewardValue: real("reward_value").notNull(),
  note: text("note").notNull(),
  createdAt: text("created_at").notNull(),
});

export const reflections = sqliteTable("reflections", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull(),
  actualBenefit: text("actual_benefit").notNull(),
  perceivedDifficulty: integer("perceived_difficulty").notNull(),
  confidenceGain: real("confidence_gain").notNull(),
  memo: text("memo").notNull(),
  createdAt: text("created_at").notNull(),
});
