import { create } from "zustand";

export type ScreenId = "now" | "inbox" | "plan" | "history" | "settings";

type AppState = {
  currentScreen: ScreenId;
  setScreen: (screen: ScreenId) => void;
};

export const useAppStore = create<AppState>((set) => ({
  currentScreen: "now",
  setScreen: (screen) => set({ currentScreen: screen }),
}));
