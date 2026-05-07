import { useTaskStore } from "../../state/task-store";
import { screenLabels, useAppStore } from "../../state/app-store";

const items = [
  { id: "now", label: "Act" },
  { id: "inbox", label: "Observe" },
  { id: "plan", label: "Orient" },
  { id: "analysis", label: "分析" },
  { id: "history", label: "履歴" },
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
          <h1 className="font-display text-4xl text-ink md:text-5xl">{screenLabels[currentScreen]}</h1>
          {!isNow && recommendation ? <p className="text-sm text-white/38">{recommendation.task.title}</p> : null}
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
      </div>
    </header>
  );
}
