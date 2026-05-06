import { useTaskStore } from "../../state/task-store";
import { screenLabels, useAppStore } from "../../state/app-store";

const items = [
  { id: "now", label: "今" },
  { id: "inbox", label: "入力" },
  { id: "plan", label: "計画" },
  { id: "history", label: "履歴" },
  { id: "settings", label: "設定" },
] as const;

export function Header() {
  const recommendation = useTaskStore((state) => state.recommendation);
  const currentScreen = useAppStore((state) => state.currentScreen);
  const setScreen = useAppStore((state) => state.setScreen);
  const isNow = currentScreen === "now";

  return (
    <header className={`border-b border-white/10 bg-black/60 backdrop-blur-xl ${isNow ? "px-5 py-4 md:px-8" : "px-5 py-5 md:px-8"}`}>
      <div className={`flex flex-col ${isNow ? "gap-3" : "gap-4"}`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.28em] text-white/36">jikko v0.2</p>
            <div className="flex items-end gap-3">
              <h1 className="font-display text-4xl text-ink md:text-5xl">{screenLabels[currentScreen]}</h1>
              <p className="pb-1 text-sm text-white/40">個人用の実行支援</p>
            </div>
          </div>
          {!isNow && recommendation && (
            <div className="max-w-lg rounded-[1.4rem] border border-white/10 bg-white/[0.04] px-5 py-4 shadow-card backdrop-blur-xl">
              <p className="text-xs tracking-[0.24em] text-white/40">推奨中</p>
              <p className="mt-2 max-w-md text-lg font-semibold text-ink md:text-xl">
                {recommendation.task.title}
              </p>
            </div>
          )}
        </div>
        <nav className="flex flex-wrap gap-2">
          {items.map((item) => {
            const isActive = item.id === currentScreen;
            return (
              <button
                key={item.id}
                className={`rounded-full border px-4 py-2 text-sm outline-none transition focus-visible:ring-1 focus-visible:ring-accent/45 ${
                  isActive
                    ? "border-accent/45 bg-accent/12 text-ink"
                    : "border-white/10 bg-white/[0.04] text-white/65 hover:border-white/20 hover:text-ink"
                }`}
                onClick={() => setScreen(item.id)}
                type="button"
              >
                {item.label}
              </button>
            );
          })}
        </nav>
        {!isNow ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/46">
            いまはデモデータで体験を整える段階です。判断画面を先に磨き、保存の本接続は次段階で重ねます。
          </div>
        ) : null}
      </div>
    </header>
  );
}
