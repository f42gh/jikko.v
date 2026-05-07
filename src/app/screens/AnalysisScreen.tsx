import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTaskStore } from "../../state/task-store";
import { StatCard } from "../components/StatCard";

export function AnalysisScreen() {
  const analysisMetrics = useTaskStore((state) => state.analysisMetrics);
  const analysisSuggestions = useTaskStore((state) => state.analysisSuggestions);
  const weights = useTaskStore((state) => state.weights);
  const { summary, roiSeries, effortSeries, flowSeries } = analysisMetrics;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="font-display text-3xl text-ink">Analysis</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">
            履歴を飾るのではなく、ROI 設定と進め方の癖を見ます。次の判断を少し良くするための画面です。
          </p>
        </div>
        <div className="rounded-3xl border border-accent/20 bg-accent/8 px-5 py-4 text-right">
          <p className="text-xs tracking-[0.18em] text-white/38">現在の重み</p>
          <p className="mt-2 text-sm text-ink">
            ROI {weights.roi.toFixed(1)} / Cost {weights.effortPenalty.toFixed(1)}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="完了率"
          note="完了と時間切れの比率"
          value={`${Math.round(summary.completionRate * 100)}%`}
        />
        <StatCard
          label="時間切れ率"
          note="見積もりの苦しさ"
          value={`${Math.round(summary.timeoutRate * 100)}%`}
        />
        <StatCard
          label="ROI 差分"
          note="見積もりと実績の平均差"
          value={formatSigned(summary.averageRoiGap)}
        />
        <StatCard
          label="安定度"
          note="戻りの少なさ"
          value={`${Math.round(summary.focusStability * 100)}%`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          description="見積もり ROI と実績 ROI を日単位で比較します。"
          title="ROI の見積もり差"
        >
          <ResponsiveContainer height="100%" width="100%">
            <LineChart data={roiSeries}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis dataKey="label" stroke="#a1a1aa" />
              <YAxis stroke="#a1a1aa" />
              <Tooltip />
              <Legend />
              <Line
                dataKey="estimated"
                name="見積もり"
                stroke="#f6c66d"
                strokeWidth={2.5}
                type="monotone"
              />
              <Line
                dataKey="actual"
                name="実績"
                stroke="#b0e4cc"
                strokeWidth={3}
                type="monotone"
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          description="予定時間と実際にかかった時間の差を見ます。"
          title="時間見積もり差"
        >
          <ResponsiveContainer height="100%" width="100%">
            <LineChart data={effortSeries}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis dataKey="label" stroke="#a1a1aa" />
              <YAxis stroke="#a1a1aa" />
              <Tooltip />
              <Legend />
              <Line
                dataKey="estimated"
                name="予定"
                stroke="#76b7ff"
                strokeWidth={2.5}
                type="monotone"
              />
              <Line
                dataKey="actual"
                name="実績"
                stroke="#ff8b7b"
                strokeWidth={3}
                type="monotone"
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <ChartCard
          description="どこで戻ったかを見ると、改善すべき癖が見えます。"
          title="ループの戻り方"
        >
          <ResponsiveContainer height="100%" width="100%">
            <BarChart data={flowSeries}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis dataKey="label" stroke="#a1a1aa" />
              <YAxis allowDecimals={false} stroke="#a1a1aa" />
              <Tooltip />
              <Legend />
              <Bar dataKey="completed" fill="#b0e4cc" name="完了" radius={[10, 10, 0, 0]} />
              <Bar dataKey="timedOut" fill="#ff9b77" name="時間切れ" radius={[10, 10, 0, 0]} />
              <Bar dataKey="reoriented" fill="#9ab6ff" name="再評価" radius={[10, 10, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-card backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-ink">補正候補</p>
              <p className="mt-1 text-sm text-white/48">自動変更せず、提案だけ出します。</p>
            </div>
            <div className="text-right">
              <p className="text-xs tracking-[0.18em] text-white/34">候補 ROI 合計</p>
              <p className="mt-1 text-lg font-semibold text-ink">{summary.totalExpectedRoi.toFixed(1)}</p>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {analysisSuggestions.map((suggestion) => (
              <article
                key={suggestion.id}
                className="rounded-2xl border border-white/10 bg-black/20 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-ink">{suggestion.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-white/55">{suggestion.summary}</p>
                  </div>
                  <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-white/42">
                    {suggestion.kind}
                  </span>
                </div>
                <p className="mt-3 text-xs tracking-[0.16em] text-accent/90">{suggestion.impactLabel}</p>
                {suggestion.recommendedWeights ? (
                  <p className="mt-2 text-sm text-white/48">
                    ROI {suggestion.recommendedWeights.roi?.toFixed(1) ?? weights.roi.toFixed(1)} /
                    Cost {suggestion.recommendedWeights.effortPenalty?.toFixed(1) ?? weights.effortPenalty.toFixed(1)}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-card backdrop-blur-xl">
      <div className="mb-4">
        <p className="text-sm font-medium text-ink">{title}</p>
        <p className="mt-1 text-sm text-white/48">{description}</p>
      </div>
      <div className="h-72">{children}</div>
    </section>
  );
}

function formatSigned(value: number) {
  if (value > 0) {
    return `+${value.toFixed(1)}`;
  }

  return value.toFixed(1);
}
