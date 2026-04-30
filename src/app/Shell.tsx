import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { HistoryScreen } from "./screens/HistoryScreen";
import { InboxScreen } from "./screens/InboxScreen";
import { NowScreen } from "./screens/NowScreen";
import { PlanScreen } from "./screens/PlanScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import type { ScreenId } from "../state/app-store";

type ShellProps = {
  currentScreen: ScreenId;
  isReady: boolean;
};

export function Shell({ currentScreen, isReady }: ShellProps) {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <div className="mx-auto grid min-h-screen max-w-7xl grid-cols-1 lg:grid-cols-[280px_1fr]">
        <Sidebar />
        <main className="border-l border-black/10 bg-white/40 backdrop-blur-sm">
          <Header />
          <div className="p-6 md:p-10">
            {!isReady ? (
              <div className="rounded-3xl border border-black/10 bg-white p-10 shadow-card">
                <p className="font-display text-3xl">Initializing jikko...</p>
              </div>
            ) : (
              <>
                {currentScreen === "now" && <NowScreen />}
                {currentScreen === "inbox" && <InboxScreen />}
                {currentScreen === "plan" && <PlanScreen />}
                {currentScreen === "history" && <HistoryScreen />}
                {currentScreen === "settings" && <SettingsScreen />}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
