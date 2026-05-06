import { useTaskStore } from "../../state/task-store";

const weightLabels: Record<string, string> = {
  urgency: "急ぎ",
  impact: "効き",
  penaltyOfDelay: "遅延コスト",
  momentumGain: "勢い",
  effortEstimate: "手間",
  emotionalResistance: "抵抗",
  energyRequired: "体力",
};

export function SettingsScreen() {
  const weights = useTaskStore((state) => state.weights);
  const updateWeight = useTaskStore((state) => state.updateWeight);

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-card backdrop-blur-xl">
      <div className="mb-6">
        <h2 className="font-display text-3xl text-ink">判断の重み</h2>
        <p className="mt-2 text-sm leading-6 text-white/55">
          ここは後ろ寄りの画面です。まずは触らず使って、違和感が出てから調整します。
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {Object.entries(weights).map(([key, value]) => (
          <label className="block" key={key}>
            <span className="mb-2 block text-sm font-medium">{weightLabels[key] ?? key}</span>
            <input
              className="w-full rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-ink outline-none transition focus:border-accent/60"
              onChange={(event) => updateWeight(key, Number(event.target.value))}
              step={0.05}
              type="number"
              value={value}
            />
          </label>
        ))}
      </div>
    </div>
  );
}
