import { AnalysisScreen } from "./screens/AnalysisScreen";
import { Header } from "./components/Header";
import { HistoryScreen } from "./screens/HistoryScreen";
import { InboxScreen } from "./screens/InboxScreen";
import { NowScreen } from "./screens/NowScreen";
import { PlanScreen } from "./screens/PlanScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { useAppStore, type ScreenId } from "../state/app-store";

type ShellProps = {
  currentScreen: ScreenId;
  isReady: boolean;
};

export function Shell({ currentScreen, isReady }: ShellProps) {
  const content = renderScreen(currentScreen);

  return (
    <div className="min-h-screen bg-paper text-ink">
      <div className="mx-auto min-h-screen max-w-6xl px-4 py-4 md:px-6 md:py-6">
        <main className="overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-950/60 shadow-card backdrop-blur-xl">
          <Header />
          {!isReady ? (
            <div className="p-6 md:p-10">
              <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-10 shadow-card backdrop-blur-xl">
                <p className="font-display text-3xl">起動中</p>
              </div>
            </div>
          ) : (
            <div className="px-5 py-6 md:px-8 md:py-8">
              <div className="mx-auto w-full">{content}</div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function renderScreen(screen: ScreenId) {
  switch (screen) {
    case "now":
      return <NowScreen />;
    case "inbox":
      return <InboxScreen />;
    case "plan":
      return <PlanScreen />;
    case "analysis":
      return <AnalysisScreen />;
    case "history":
      return <HistoryScreen />;
    case "settings":
      return <SettingsScreen />;
    default:
      return <NowScreen />;
  }
}
