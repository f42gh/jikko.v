import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTaskStore } from "../../state/task-store";
import { createTaskInputSchema, type CreateTaskInput } from "../../domain/tasks/types";

export function InboxScreen() {
  const addObservedTask = useTaskStore((state) => state.addObservedTask);
  const tasks = useTaskStore((state) => state.tasks);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateTaskInput>({
    resolver: zodResolver(createTaskInputSchema),
    defaultValues: {
      title: "",
      observeMemo: "",
    },
  });

  const onSubmit = (data: CreateTaskInput) => {
    void addObservedTask(data);
    reset();
  };

  const observeTasks = tasks.filter((task) => task.status === "observe");

  return (
    <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
      <form
        className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-card backdrop-blur-xl"
        onSubmit={handleSubmit(onSubmit)}
      >
        <div className="mb-5">
          <h2 className="font-display text-3xl text-ink">Observe を置く</h2>
          <p className="mt-2 text-sm leading-6 text-white/55">
            ここでは判断しません。名前と観測だけを静かに置いて、あとで意味づけに回します。
          </p>
        </div>
        <div className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-medium">タスク名</span>
            <input
              className="w-full rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-ink outline-none transition focus:border-accent/60"
              {...register("title")}
            />
            {errors.title ? <span className="mt-1 block text-sm text-accent">{errors.title.message}</span> : null}
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium">観測メモ</span>
            <textarea
              className="min-h-28 w-full rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-ink outline-none transition focus:border-accent/60"
              placeholder="いま気になっていること、引っかかっていること"
              {...register("observeMemo")}
            />
          </label>
        </div>
        <button
          className="mt-6 rounded-full border border-accent/35 bg-accent/10 px-5 py-3 text-sm font-semibold text-accent outline-none transition hover:bg-accent/15 focus-visible:ring-1 focus-visible:ring-accent/45"
          type="submit"
        >
          Observe に追加
        </button>
      </form>

      <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-card backdrop-blur-xl">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl text-ink">観測の保留箱</h2>
            <p className="mt-2 text-sm text-white/52">ここにあるものは、まだ優先順位づけに載りません。</p>
          </div>
          <p className="rounded-full border border-white/10 px-3 py-1 text-sm text-white/55">{observeTasks.length} 件</p>
        </div>
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <StatusMetric label="Observe" value={String(observeTasks.length)} />
          <StatusMetric label="Orient" value={String(tasks.filter((task) => task.status === "orient").length)} />
          <StatusMetric label="Act" value={String(tasks.filter((task) => task.status === "act").length)} />
        </div>
        <div className="space-y-3">
          {observeTasks.map((task) => (
            <article className="rounded-2xl border border-white/10 bg-zinc-950/75 p-4" key={task.id}>
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-lg font-semibold">{task.title}</h3>
                <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-white/45">Observe</span>
              </div>
              {task.observeMemo ? <p className="mt-1 text-sm text-white/55">{task.observeMemo}</p> : null}
            </article>
          ))}
          {observeTasks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/12 px-4 py-8 text-center text-sm text-white/40">
              観測待ちはありません。
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function StatusMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
      <p className="text-xs tracking-[0.18em] text-white/38">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-ink">{value}</p>
    </div>
  );
}
