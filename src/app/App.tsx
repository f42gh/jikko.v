import { useEffect } from "react";
import { Shell } from "./Shell";
import { useAppStore } from "../state/app-store";
import { useTaskStore } from "../state/task-store";

export default function App() {
  const initialize = useTaskStore((state) => state.initialize);
  const isReady = useTaskStore((state) => state.isReady);
  const currentScreen = useAppStore((state) => state.currentScreen);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  return <Shell currentScreen={currentScreen} isReady={isReady} />;
}
