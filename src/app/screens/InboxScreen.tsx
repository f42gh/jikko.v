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

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <form
        className="rounded-3xl border border-black/10 bg-white p-6 shadow-card"
        onSubmit={handleSubmit(onSubmit)}
      >
        <p className="text-xs uppercase tracking-[0.3em] text-black/45">Capture task</p>
        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-medium">Title</span>
            <input
              className="w-full rounded-2xl border border-black/10 bg-paper px-4 py-3 outline-none"
              {...register("title")}
            />
            {errors.title && <span className="mt-1 block text-sm text-ember">{errors.title.message}</span>}
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium">Description</span>
            <textarea
              className="min-h-28 w-full rounded-2xl border border-black/10 bg-paper px-4 py-3 outline-none"
              {...register("description")}
            />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            {[
              ["effortEstimate", "Effort"],
              ["urgency", "Urgency"],
              ["impact", "Impact"],
              ["penaltyOfDelay", "Penalty of delay"],
              ["momentumGain", "Momentum gain"],
              ["emotionalResistance", "Emotional resistance"],
              ["energyRequired", "Energy required"],
            ].map(([key, label]) => (
              <label className="block" key={key}>
                <span className="mb-2 block text-sm font-medium">{label}</span>
                <input
                  className="w-full rounded-2xl border border-black/10 bg-paper px-4 py-3 outline-none"
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
        <button
          className="mt-6 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-paper"
          type="submit"
        >
          Add task
        </button>
      </form>

      <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-card">
        <p className="text-xs uppercase tracking-[0.3em] text-black/45">Inbox items</p>
        <div className="mt-5 space-y-3">
          {tasks.map((task) => (
            <article className="rounded-2xl bg-clay/35 p-4" key={task.id}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold">{task.title}</h3>
                  <p className="mt-1 text-sm text-black/60">{task.description || "No description."}</p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs uppercase tracking-[0.2em] text-black/50">
                  {task.status}
                </span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
