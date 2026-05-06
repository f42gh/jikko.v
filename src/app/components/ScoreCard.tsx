import type { Recommendation } from "../../domain/scoring/types";

export function ScoreCard({ recommendation }: { recommendation: Recommendation }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-card backdrop-blur-xl">
      <div className="grid gap-3 md:grid-cols-2">
        {Object.entries(recommendation.breakdown).map(([key, value]) => (
          <div key={key} className="rounded-2xl border border-white/10 bg-zinc-950/75 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.2em] text-white/40">{key}</p>
            <p className="mt-2 text-2xl font-semibold">{value.toFixed(2)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
