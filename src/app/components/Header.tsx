import { useTaskStore } from "../../state/task-store";

export function Header() {
  const recommendation = useTaskStore((state) => state.recommendation);

  return (
    <header className="border-b border-black/10 px-6 py-5 md:px-10">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-black/55">
            jikko v1 scaffold
          </p>
          <h1 className="font-display text-4xl text-ink">Do what matters now.</h1>
        </div>
        <div className="rounded-2xl border border-brass/20 bg-brass/10 px-4 py-3">
          <p className="text-xs uppercase tracking-[0.25em] text-black/55">
            Current recommendation
          </p>
          <p className="mt-1 max-w-md text-sm">
            {recommendation?.task.title ?? "No ranked task available yet."}
          </p>
        </div>
      </div>
    </header>
  );
}
