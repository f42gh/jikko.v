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
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Completed"
          note="Finished tasks captured in the local event stream."
          value={String(historyMetrics.completedCount)}
        />
        <StatCard
          label="Momentum"
          note="Synthetic confidence score from completed work."
          value={historyMetrics.confidenceScore.toFixed(1)}
        />
        <StatCard
          label="ROI"
          note="Expected return recovered from prioritized action."
          value={historyMetrics.totalRoi.toFixed(1)}
        />
      </div>
      <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-card">
        <p className="text-xs uppercase tracking-[0.3em] text-black/45">Completion trend</p>
        <div className="mt-6 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={historyMetrics.chartData}>
              <XAxis dataKey="label" stroke="#777" />
              <YAxis stroke="#777" />
              <Tooltip />
              <Line dataKey="completed" stroke="#b07a1a" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
