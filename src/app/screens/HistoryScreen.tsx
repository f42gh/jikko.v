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
        <h2 className="font-display text-3xl text-ink">積み上がり</h2>
        <p className="mt-2 text-sm leading-6 text-white/55">
          まだ簡易表示ですが、完了と手応えが返ってくるかを先に確認します。
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="完了"
          note=""
          value={String(historyMetrics.completedCount)}
        />
        <StatCard
          label="勢い"
          note=""
          value={historyMetrics.confidenceScore.toFixed(1)}
        />
        <StatCard
          label="ROI"
          note=""
          value={historyMetrics.totalRoi.toFixed(1)}
        />
      </div>
      <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-card backdrop-blur-xl">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-ink">完了推移</p>
            <p className="mt-1 text-sm text-white/48">実データ接続前の簡易グラフです。</p>
          </div>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
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
