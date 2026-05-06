import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTaskStore } from "../../state/task-store";
import { createTaskInputSchema, type CreateTaskInput } from "../../domain/tasks/types";

export function InboxScreen() {
  const addTask = useTaskStore((state) => state.addTask);
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
      description: "",
      effortEstimate: 3,
      urgency: 3,
      impact: 3,
      penaltyOfDelay: 3,
      momentumGain: 3,
      emotionalResistance: 2,
      energyRequired: 3,
    },
  });

  const onSubmit = (data: CreateTaskInput) => {
    addTask(data);
    reset();
  };

  const queuedTasks = tasks.filter((task) => task.status === "pending").length;

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <form
        className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-card backdrop-blur-xl"
        onSubmit={handleSubmit(onSubmit)}
      >
        <div className="mb-5">
          <h2 className="font-display text-3xl text-ink">次の候補を置く</h2>
          <p className="mt-2 text-sm leading-6 text-white/55">
            ここは没入の外側です。タイトルと判断材料だけを静かに足せるようにします。
          </p>
        </div>
        <div className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-medium">名前</span>
            <input
              className="w-full rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-ink outline-none transition focus:border-accent/60"
              {...register("title")}
            />
            {errors.title && <span className="mt-1 block text-sm text-accent">{errors.title.message}</span>}
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium">メモ</span>
            <textarea
              className="min-h-24 w-full rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-ink outline-none transition focus:border-accent/60"
              {...register("description")}
            />
          </label>
          <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
            <div className="mb-4">
              <p className="text-sm font-medium text-ink">判断材料</p>
              <p className="mt-1 text-sm text-white/45">1 から 5 の範囲でざっくり入れます。</p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                ["urgency", "急ぎ"],
                ["impact", "効き"],
                ["penaltyOfDelay", "遅延"],
                ["momentumGain", "勢い"],
                ["effortEstimate", "手間"],
                ["energyRequired", "体力"],
                ["emotionalResistance", "抵抗"],
              ].map(([key, label]) => (
                <label className="block" key={key}>
                  <span className="mb-2 block text-sm font-medium">{label}</span>
                  <input
                    className="w-full rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-ink outline-none transition focus:border-accent/60"
                    max={5}
                    min={1}
                    step={1}
                    type="number"
                    {...register(key as keyof CreateTaskInput, { valueAsNumber: true })}
                  />
                </label>
              ))}
            </div>
          </div>
        </div>
        <button
          className="mt-6 rounded-full border border-accent/35 bg-accent/10 px-5 py-3 text-sm font-semibold text-accent outline-none transition hover:bg-accent/15 focus-visible:ring-1 focus-visible:ring-accent/45"
          type="submit"
        >
          追加
        </button>
      </form>

      <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-card backdrop-blur-xl">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl text-ink">判断待ちの束</h2>
            <p className="mt-2 text-sm text-white/52">ここに置いた候補が、あとで今の判断材料になります。</p>
          </div>
          <p className="rounded-full border border-white/10 px-3 py-1 text-sm text-white/55">{tasks.length} 件</p>
        </div>
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <StatusMetric label="保留" value={String(queuedTasks)} />
          <StatusMetric label="進行中" value={String(tasks.filter((task) => task.status === "in_progress").length)} />
          <StatusMetric label="完了" value={String(tasks.filter((task) => task.status === "done").length)} />
        </div>
        <div className="space-y-3">
          {tasks.map((task) => (
            <article className="rounded-2xl border border-white/10 bg-zinc-950/75 p-4" key={task.id}>
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-lg font-semibold">{task.title}</h3>
                <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-white/45">
                  {statusLabel(task.status)}
                </span>
              </div>
              {task.description && <p className="mt-1 text-sm text-white/55">{task.description}</p>}
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

function statusLabel(status: string) {
  switch (status) {
    case "in_progress":
      return "進行中";
    case "done":
      return "完了";
    default:
      return "保留";
  }
}

function StatusMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
      <p className="text-xs tracking-[0.18em] text-white/38">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-ink">{value}</p>
    </div>
  );
}
