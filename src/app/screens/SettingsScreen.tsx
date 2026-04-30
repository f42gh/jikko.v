import { useTaskStore } from "../../state/task-store";

export function SettingsScreen() {
  const weights = useTaskStore((state) => state.weights);
  const updateWeight = useTaskStore((state) => state.updateWeight);

  return (
    <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-card">
      <p className="text-xs uppercase tracking-[0.3em] text-black/45">Scoring weights</p>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {Object.entries(weights).map(([key, value]) => (
          <label className="block" key={key}>
            <span className="mb-2 block text-sm font-medium">{key}</span>
            <input
              className="w-full rounded-2xl border border-black/10 bg-paper px-4 py-3 outline-none"
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
