import { describe, expect, it } from "vitest";
import { scoreTask } from "./engine";
import type { Task } from "../tasks/types";

const baseTask: Task = {
  id: "task",
  title: "Important task",
  description: "",
  status: "pending",
  parentTaskId: null,
  effortEstimate: 2,
  urgency: 5,
  impact: 5,
  penaltyOfDelay: 5,
  momentumGain: 4,
  emotionalResistance: 1,
  energyRequired: 2,
  dueAt: null,
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
};

describe("scoreTask", () => {
  it("produces a positive priority for a high-impact task", () => {
    const recommendation = scoreTask(baseTask);

    expect(recommendation.priorityScore).toBeGreaterThan(2);
    expect(recommendation.expectedRoi).toBeGreaterThan(1);
    expect(recommendation.whyNowSummary).toContain("今やる価値");
  });
});
