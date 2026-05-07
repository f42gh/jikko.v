import { useAppStore } from "../../state/app-store";
import { useTaskStore } from "../../state/task-store";
import { StatCard } from "../components/StatCard";

export function HistoryScreen() {
  const analysisMetrics = useTaskStore((state) => state.analysisMetrics);
  const setScreen = useAppStore((state) => state.setScreen);
  const { summary } = analysisMetrics;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="font-display text-3xl text-ink">履歴</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">
            ここは完了の実感を返す場所に絞ります。比較と補正は Analysis に移しました。
          </p>
        </div>
        <button
          className="rounded-full border border-accent/35 bg-accent/10 px-5 py-3 text-sm font-semibold text-accent outline-none transition hover:bg-accent/15 focus-visible:ring-1 focus-visible:ring-accent/45"
          onClick={() => setScreen("analysis")}
          type="button"
        >
          Analysis を見る
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="完了" note="終えた回数" value={String(summary.completedCount)} />
        <StatCard label="分割" note="小さくした回数" value={String(summary.decompositionCount)} />
        <StatCard
          label="分割完了率"
          note="分割後に終わった割合"
          value={`${Math.round(summary.decompositionCompletionRate * 100)}%`}
        />
        <StatCard
          label="安定度"
          note="戻りの少なさ"
          value={`${Math.round(summary.focusStability * 100)}%`}
        />
      </div>

      <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-card backdrop-blur-xl">
        <p className="text-sm font-medium text-ink">この画面で残すもの</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <HistoryNote
            body="完了の蓄積を軽く見返せること。"
            title="成果"
          />
          <HistoryNote
            body="分割したタスクが最後まで届いているか。"
            title="継続"
          />
          <HistoryNote
            body="判断の補正は Analysis に任せること。"
            title="役割"
          />
        </div>
      </section>
    </div>
  );
}

function HistoryNote({ title, body }: { title: string; body: string }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="text-xs tracking-[0.18em] text-white/36">{title}</p>
      <p className="mt-3 text-sm leading-6 text-white/55">{body}</p>
    </article>
  );
}
