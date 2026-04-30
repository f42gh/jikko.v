import type { ScoreWeights } from "./types";

export const defaultScoreWeights: ScoreWeights = {
  urgency: 0.25,
  impact: 0.25,
  penaltyOfDelay: 0.2,
  momentumGain: 0.15,
  effortEstimate: 0.1,
  emotionalResistance: 0.03,
  energyRequired: 0.02,
};
