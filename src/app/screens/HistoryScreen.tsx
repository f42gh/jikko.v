import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTaskStore } from "../../state/task-store";
import { StatCard } from "../components/StatCard";

export function HistoryScreen() {
  const historyMetrics = useTaskStore((state) => state.historyMetrics);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-3xl text-ink">サイクルの履歴</h2>
        <p className="mt-2 text-sm leading-6 text-white/55">
          完了数だけでなく、戻り方と分割の質も見ます。OODA が回っているかをここで確認します。
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="完了" note="" value={String(historyMetrics.completedCount)} />
        <StatCard label="時間切れ" note="" value={String(historyMetrics.timeoutCount)} />
        <StatCard label="再評価" note="" value={String(historyMetrics.reorientedCount)} />
        <StatCard label="分割" note="" value={String(historyMetrics.decompositionCount)} />
        <StatCard
          label="分割完了率"
          note=""
          value={`${Math.round(historyMetrics.decompositionCompletionRate * 100)}%`}
        />
      </div>
      <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-card backdrop-blur-xl">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-ink">完了推移</p>
            <p className="mt-1 text-sm text-white/48">日ごとの completed イベントを簡易に見ています。</p>
          </div>
          <div className="text-right">
            <p className="text-xs tracking-[0.18em] text-white/34">現在の候補 ROI 合計</p>
            <p className="mt-1 text-lg font-semibold text-ink">{historyMetrics.totalRoi.toFixed(1)}</p>
          </div>
        </div>
        <div className="h-72">
          <ResponsiveContainer height="100%" width="100%">
            <LineChart data={historyMetrics.chartData}>
              <XAxis dataKey="label" stroke="#a1a1aa" />
              <YAxis stroke="#a1a1aa" />
              <Tooltip />
              <Line dataKey="completed" stroke="#b0e4cc" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
