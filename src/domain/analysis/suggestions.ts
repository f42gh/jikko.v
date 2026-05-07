import type { ScoreWeights } from "../scoring/types";
import type { AnalysisMetrics, AnalysisSuggestion } from "./types";

export function buildAnalysisSuggestions(
  metrics: AnalysisMetrics,
  weights: ScoreWeights,
): AnalysisSuggestion[] {
  const suggestions: AnalysisSuggestion[] = [];
  const { summary } = metrics;

  if (summary.timeoutRate >= 0.35) {
    suggestions.push({
      id: "raise-effort-penalty",
      kind: "weight",
      title: "時間見積もりが強気です",
      summary: `時間切れ率が ${Math.round(summary.timeoutRate * 100)}% あります。effortPenalty を ${weights.effortPenalty.toFixed(1)} から ${(weights.effortPenalty + 0.2).toFixed(1)} へ上げる候補です。`,
      impactLabel: "開始前に短いタスクを上へ寄せる",
      recommendedWeights: {
        effortPenalty: roundToTenth(weights.effortPenalty + 0.2),
      },
    });
  }

  if (summary.averageRoiGap <= -0.6) {
    suggestions.push({
      id: "temper-roi-weight",
      kind: "weight",
      title: "ROI 入力がやや楽観寄りです",
      summary: `見積もり ROI に対して実績差分が ${summary.averageRoiGap.toFixed(1)} です。roi 重みを ${weights.roi.toFixed(1)} から ${Math.max(0.8, weights.roi - 0.2).toFixed(1)} へ落として、短期で回収しやすい候補を優先できます。`,
      impactLabel: "高見積もりの偏りを抑える",
      recommendedWeights: {
        roi: roundToTenth(Math.max(0.8, weights.roi - 0.2)),
      },
    });
  }

  if (summary.reorientationRate >= 0.25) {
    suggestions.push({
      id: "tighten-observe-input",
      kind: "input",
      title: "Observe の材料が足りていません",
      summary: `再評価率が ${Math.round(summary.reorientationRate * 100)}% あります。Observe の時点で「何を見れば進めるか」を一言だけ残すと、Orient の戻りが減ります。`,
      impactLabel: "着手前の迷いを減らす",
    });
  }

  if (summary.decompositionCount > 0 && summary.decompositionCompletionRate < 0.5) {
    suggestions.push({
      id: "decompose-smaller",
      kind: "decomposition",
      title: "分割後の粒度をさらに小さくできます",
      summary: `分割完了率が ${Math.round(summary.decompositionCompletionRate * 100)}% です。分割タスクを 15〜25 分で終わる粒度に寄せると、完了まで届きやすくなります。`,
      impactLabel: "分割後の放置を減らす",
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({
      id: "steady-loop",
      kind: "confidence",
      title: "判断ループは安定しています",
      summary: "大きな補正候補はまだ出ていません。分析値が増えるほど、補正提案の精度も上がります。",
      impactLabel: "このまま履歴を貯める",
    });
  }

  return suggestions;
}

function roundToTenth(value: number) {
  return Math.round(value * 10) / 10;
}
