import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  status: text("status").notNull(),
  parentTaskId: text("parent_task_id"),
  effortEstimate: integer("effort_estimate").notNull(),
  urgency: integer("urgency").notNull(),
  impact: integer("impact").notNull(),
  penaltyOfDelay: integer("penalty_of_delay").notNull(),
  momentumGain: integer("momentum_gain").notNull(),
  emotionalResistance: integer("emotional_resistance").notNull(),
  energyRequired: integer("energy_required").notNull(),
  dueAt: text("due_at"),
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
