import { useAppStore, type ScreenId } from "../../state/app-store";

const items: Array<{ id: ScreenId; label: string }> = [
  { id: "now", label: "Act" },
  { id: "inbox", label: "Observe" },
  { id: "plan", label: "Orient" },
  { id: "analysis", label: "分析" },
  { id: "history", label: "履歴" },
];

export function Sidebar() {
  const currentScreen = useAppStore((state) => state.currentScreen);
  const setScreen = useAppStore((state) => state.setScreen);

  return (
    <aside className="border-b border-white/10 bg-black p-6 lg:border-b-0 lg:p-8">
      <div className="sticky top-0">
        <nav className="space-y-2">
          {items.map((item) => {
            const isActive = item.id === currentScreen;
            return (
              <button
                key={item.id}
                className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                  isActive
                    ? "border-accent/50 bg-accent/15 text-ink shadow-card"
                    : "border-white/10 bg-white/[0.045] text-ink backdrop-blur-xl hover:border-accent/35 hover:bg-white/[0.08]"
                }`}
                onClick={() => setScreen(item.id)}
                type="button"
              >
                <div className="font-display text-2xl">{item.label}</div>
              </button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
