import { create } from "zustand";

export type ScreenId = "now" | "inbox" | "plan" | "history" | "settings";

export const screenLabels: Record<ScreenId, string> = {
  now: "Act",
  inbox: "Observe",
  plan: "Orient",
  history: "履歴",
  settings: "設定",
};

type AppState = {
  currentScreen: ScreenId;
  setScreen: (screen: ScreenId) => void;
};

export const useAppStore = create<AppState>((set) => ({
  currentScreen: "now",
  setScreen: (screen) => set({ currentScreen: screen }),
}));
