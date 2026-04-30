import { useAppStore, type ScreenId } from "../../state/app-store";

const items: Array<{ id: ScreenId; label: string; note: string }> = [
  { id: "now", label: "Now", note: "One clear next action" },
  { id: "inbox", label: "Inbox", note: "Capture and decompose tasks" },
  { id: "plan", label: "Plan", note: "Ranking and rationale" },
  { id: "history", label: "History", note: "Confidence and ROI" },
  { id: "settings", label: "Settings", note: "Weights and backup" },
];

export function Sidebar() {
  const currentScreen = useAppStore((state) => state.currentScreen);
  const setScreen = useAppStore((state) => state.setScreen);

  return (
    <aside className="border-b border-black/10 bg-transparent p-6 lg:border-b-0 lg:p-8">
      <div className="sticky top-0">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.35em] text-black/55">Mission</p>
          <p className="mt-3 text-sm leading-7 text-black/75">
            Reduce decision fatigue. Make the next worthwhile action feel obvious.
          </p>
        </div>
        <nav className="space-y-3">
          {items.map((item) => {
            const isActive = item.id === currentScreen;
            return (
              <button
                key={item.id}
                className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                  isActive
                    ? "border-ink bg-ink text-paper shadow-card"
                    : "border-black/10 bg-white/60 text-ink hover:border-black/25 hover:bg-white"
                }`}
                onClick={() => setScreen(item.id)}
                type="button"
              >
                <div className="font-display text-2xl">{item.label}</div>
                <div
                  className={`mt-1 text-sm ${
                    isActive ? "text-paper/80" : "text-black/55"
                  }`}
                >
                  {item.note}
                </div>
              </button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
